"use server";

import { Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, getOwnedPlan, assertOwnsPlan } from "@/lib/data";
import {
  getGemini,
  isGeminiConfigured,
  GEMINI_MODEL,
  geminiErrorMessage,
} from "@/lib/gemini";
import { CATEGORY_TYPE_LABEL, type CategoryType } from "@/lib/categories";
import {
  coachFigures,
  monthKey,
  type CalcCategory,
  type CalcTransaction,
  type PlanWithMeta,
} from "@/lib/calc";
import { formatMoney, toDateInputValue } from "@/lib/format";

// HARD RULE stated in every prompt: Gemini must NOT do arithmetic or invent
// numbers. For Feature A it only extracts an amount the user already typed and
// picks a category name from a list we provide; we validate/normalize after.

export type ParsedTransaction = {
  date: string; // YYYY-MM-DD (validated/normalized in our code)
  categoryId: string;
  categoryName: string;
  amount: number;
  description: string;
};

export type ParseResult =
  | { status: "ok"; parsed: ParsedTransaction }
  | { status: "error"; message: string };

function clampDateToToday(iso: string): string {
  // Accept the model's ISO date but never trust it blindly: parse, fall back to
  // today on garbage, and cap future dates at today.
  const today = new Date();
  const d = new Date(iso);
  if (isNaN(d.getTime())) return toDateInputValue(today);
  if (d.getTime() > today.getTime()) return toDateInputValue(today);
  return toDateInputValue(d);
}

export async function parseTransactionAction(
  planId: string,
  text: string,
): Promise<ParseResult> {
  const userId = await requireUserId();
  if (!isGeminiConfigured()) {
    return { status: "error", message: "ยังไม่ได้ตั้งค่า AI (GEMINI_API_KEY)" };
  }
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { status: "error", message: "พิมพ์รายการก่อน" };
  if (trimmed.length > 300) {
    return { status: "error", message: "ข้อความยาวเกินไป" };
  }

  const plan = await getOwnedPlan(planId, userId);
  if (!plan) return { status: "error", message: "ไม่พบเป้าหมาย" };
  if (plan.categories.length === 0) {
    return { status: "error", message: "เป้าหมายนี้ยังไม่มีหมวดหมู่" };
  }

  const today = toDateInputValue(new Date());
  const categoryList = plan.categories
    .map(
      (c) =>
        `- "${c.name}" (${CATEGORY_TYPE_LABEL[c.type as CategoryType]})`,
    )
    .join("\n");
  const validNames = plan.categories.map((c) => c.name);

  const prompt = `คุณเป็นตัวช่วยแยกข้อมูลรายการเงินจากข้อความภาษาไทย
กฎเด็ดขาด: ห้ามคำนวณหรือคิดเลขเอง ห้ามแต่งตัวเลขขึ้นมา ใช้ตัวเลขจำนวนเงินที่ผู้ใช้พิมพ์มาเท่านั้น
วันนี้คือ ${today} (รูปแบบ YYYY-MM-DD) ใช้สำหรับแปลงคำบอกวันแบบสัมพัทธ์ เช่น "เมื่อวาน" "วันนี้"

หมวดหมู่ที่เลือกได้ (ต้องเลือกชื่อจากรายการนี้เท่านั้น ให้เลือกที่ตรงที่สุด):
${categoryList}

ข้อความผู้ใช้: "${trimmed}"

ตอบเป็น JSON ตาม schema: date (ISO YYYY-MM-DD), categoryName (ชื่อจากรายการข้างบนเป๊ะๆ), amount (ตัวเลขที่ผู้ใช้พิมพ์), description (คำอธิบายสั้นๆ ภาษาไทย)`;

  let raw: string;
  try {
    const res = await getGemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            categoryName: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            description: { type: Type.STRING },
          },
          required: ["date", "categoryName", "amount", "description"],
        },
        temperature: 0,
      },
    });
    raw = res.text ?? "";
  } catch (err) {
    return { status: "error", message: geminiErrorMessage(err) };
  }

  let obj: { date?: string; categoryName?: string; amount?: unknown; description?: string };
  try {
    obj = JSON.parse(raw);
  } catch {
    return { status: "error", message: "AI ตอบไม่ถูกรูปแบบ ลองพิมพ์ใหม่" };
  }

  // ── Validate + normalize entirely in our code (never trust the model) ──
  const amount = Number(obj.amount);
  if (!isFinite(amount) || amount <= 0) {
    return { status: "error", message: "ไม่พบจำนวนเงินที่ถูกต้องในข้อความ" };
  }

  // Match category name to a real category (exact, else case-insensitive contains).
  const wanted = (obj.categoryName ?? "").trim();
  let match = plan.categories.find((c) => c.name === wanted);
  if (!match && wanted) {
    const lw = wanted.toLowerCase();
    match =
      plan.categories.find((c) => c.name.toLowerCase() === lw) ??
      plan.categories.find(
        (c) => c.name.toLowerCase().includes(lw) || lw.includes(c.name.toLowerCase()),
      );
  }
  // Fallback: first VARIABLE category, else first category.
  if (!match) {
    match =
      plan.categories.find((c) => (c.type as CategoryType) === "VARIABLE") ??
      plan.categories[0];
  }

  void validNames; // documented invariant: match.name is always one of these

  return {
    status: "ok",
    parsed: {
      date: clampDateToToday(obj.date ?? today),
      categoryId: match.id,
      categoryName: match.name,
      amount: Math.round(amount * 100) / 100,
      description: (obj.description ?? trimmed).slice(0, 200),
    },
  };
}

// Auto-categorization: given a free description + amount, suggest the best
// matching category id. Suggestion only — caller lets the user override.
export type SuggestResult =
  | { status: "ok"; categoryId: string; categoryName: string }
  | { status: "error"; message: string };

export async function suggestCategoryAction(
  planId: string,
  description: string,
): Promise<SuggestResult> {
  const userId = await requireUserId();
  if (!isGeminiConfigured()) {
    return { status: "error", message: "ยังไม่ได้ตั้งค่า AI" };
  }
  const desc = (description ?? "").trim();
  if (!desc) return { status: "error", message: "ใส่รายละเอียดก่อน" };

  const plan = await getOwnedPlan(planId, userId);
  if (!plan) return { status: "error", message: "ไม่พบเป้าหมาย" };
  if (plan.categories.length === 0) {
    return { status: "error", message: "ยังไม่มีหมวดหมู่" };
  }

  const categoryList = plan.categories
    .map((c) => `- "${c.name}" (${CATEGORY_TYPE_LABEL[c.type as CategoryType]})`)
    .join("\n");

  const prompt = `เลือกหมวดหมู่ที่ตรงที่สุดสำหรับรายการนี้
กฎเด็ดขาด: ห้ามคิดเลขหรือแต่งตัวเลข เลือกแค่ชื่อหมวดจากรายการ
รายละเอียด: "${desc}"
หมวดที่เลือกได้:
${categoryList}
ตอบ JSON: { categoryName: ชื่อจากรายการเป๊ะๆ }`;

  let raw: string;
  try {
    const res = await getGemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { categoryName: { type: Type.STRING } },
          required: ["categoryName"],
        },
        temperature: 0,
      },
    });
    raw = res.text ?? "";
  } catch (err) {
    return { status: "error", message: geminiErrorMessage(err) };
  }

  let wanted = "";
  try {
    wanted = (JSON.parse(raw).categoryName ?? "").trim();
  } catch {
    return { status: "error", message: "AI ตอบไม่ถูกรูปแบบ" };
  }

  const lw = wanted.toLowerCase();
  const match =
    plan.categories.find((c) => c.name === wanted) ??
    plan.categories.find((c) => c.name.toLowerCase() === lw) ??
    plan.categories.find(
      (c) => c.name.toLowerCase().includes(lw) || lw.includes(c.name.toLowerCase()),
    );
  if (!match) return { status: "error", message: "ไม่พบหมวดที่ตรง" };

  return { status: "ok", categoryId: match.id, categoryName: match.name };
}

// ── Feature B: monthly AI coach summary ─────────────────────────────────────

// Records the user's opt-in (financial figures sent to Gemini). Required before
// any summary generation.
export async function setAiOptInAction(): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  await prisma.user.update({ where: { id: userId }, data: { aiOptIn: true } });
  return { ok: true };
}

export type CoachState = {
  optedIn: boolean;
  configured: boolean;
  content: string | null;
  generatedAt: string | null;
  month: string;
};

// Reads opt-in status + any cached summary for the plan's current month.
export async function getCoachState(planId: string): Promise<CoachState> {
  const userId = await requireUserId();
  await assertOwnsPlan(planId, userId);
  const month = monthKey(new Date());
  const [user, cached] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { aiOptIn: true },
    }),
    prisma.insightSummary.findUnique({
      where: { planId_month: { planId, month } },
      select: { content: true, generatedAt: true },
    }),
  ]);
  return {
    optedIn: user.aiOptIn,
    configured: isGeminiConfigured(),
    content: cached?.content ?? null,
    generatedAt: cached?.generatedAt?.toISOString() ?? null,
    month,
  };
}

function toPlanWithMeta(
  plan: NonNullable<Awaited<ReturnType<typeof getOwnedPlan>>>,
): PlanWithMeta {
  const catType = new Map<string, CategoryType>(
    plan.categories.map((c) => [c.id, c.type as CategoryType]),
  );
  const categories: CalcCategory[] = plan.categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type as CategoryType,
    plannedMonthly: c.plannedMonthly,
    sortOrder: c.sortOrder,
  }));
  const transactions: CalcTransaction[] = plan.transactions.map((t) => ({
    id: t.id,
    categoryId: t.categoryId,
    type: catType.get(t.categoryId) ?? "VARIABLE",
    date: t.date,
    amount: t.amount,
  }));
  return {
    id: plan.id,
    name: plan.name,
    currency: plan.currency,
    targetAmount: plan.targetAmount,
    startDate: plan.startDate,
    targetDate: plan.targetDate,
    categories,
    transactions,
  };
}

export type CoachResult =
  | { status: "ok"; content: string; generatedAt: string }
  | { status: "error"; message: string };

// Generates (or regenerates) the coach summary for the plan's current month and
// caches it. All numbers are computed by us; Gemini only writes the prose.
export async function generateCoachSummaryAction(
  planId: string,
): Promise<CoachResult> {
  const userId = await requireUserId();
  if (!isGeminiConfigured()) {
    return { status: "error", message: "ยังไม่ได้ตั้งค่า AI (GEMINI_API_KEY)" };
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { aiOptIn: true },
  });
  if (!user.aiOptIn) {
    return { status: "error", message: "ต้องยินยอมก่อนใช้งาน AI" };
  }

  const plan = await getOwnedPlan(planId, userId);
  if (!plan) return { status: "error", message: "ไม่พบเป้าหมาย" };

  const month = monthKey(new Date());
  const f = coachFigures(toPlanWithMeta(plan), month);
  const cur = f.currency;
  const m = (n: number) => formatMoney(n, cur);

  // Only these precomputed figures are sent. The prompt forbids arithmetic.
  const figuresBlock = [
    `เดือน: ${f.month}`,
    `รายรับรวมเดือนนี้: ${m(f.totalIncome)}`,
    `รายจ่ายรวมเดือนนี้ (คงที่+ผันแปร): ${m(f.totalExpense)}`,
    `รายจ่ายเทียบเดือนก่อน: ${
      f.momSpendingChangePct == null
        ? "ไม่มีข้อมูลเดือนก่อน"
        : `${f.momSpendingChangePct > 0 ? "+" : ""}${f.momSpendingChangePct}%`
    }`,
    `หมวดที่ใช้มากสุด: ${
      f.topCategory
        ? `${f.topCategory.name} ${m(f.topCategory.amount)} (${f.topCategory.sharePct}% ของรายจ่าย)`
        : "ยังไม่มีรายจ่าย"
    }`,
    `ใช้จ่ายเฉลี่ยต่อวัน: ${m(f.avgDailySpend)}`,
    `ความคืบหน้าการเก็บเงิน: ${f.savingProgressPct}%`,
    `ต้องเก็บเฉลี่ยต่อเดือนเพื่อให้ทันเป้า: ${m(f.avgNeededPerMonth)}`,
    `กำหนดถึงเป้า: ${f.targetDate}`,
    `คาดการณ์ถึงเป้า: ${
      f.projectedDate
        ? `${f.projectedDate} (${
            f.daysVsTarget != null && f.daysVsTarget >= 0
              ? `เร็วกว่ากำหนด ${f.daysVsTarget} วัน`
              : `ช้ากว่ากำหนด ${Math.abs(f.daysVsTarget ?? 0)} วัน`
          })`
        : f.projectionStatus === "complete"
          ? "ถึงเป้าแล้ว"
          : "ยังเก็บไม่พอจะคาดการณ์"
    }`,
    `ส่วนต่างงบที่เด่นชัด (แผนเทียบจริง):`,
    ...f.topVariances.map(
      (v) =>
        `- ${v.name}: วางแผน ${m(v.planned)} ใช้จริง ${m(v.actual)} ส่วนต่าง ${
          v.variance >= 0 ? "+" : ""
        }${m(v.variance)}`,
    ),
  ].join("\n");

  const prompt = `คุณเป็นโค้ชการเงินส่วนตัวที่เป็นมิตร พูดภาษาไทย
กฎเด็ดขาด: ห้ามคำนวณ ห้ามคิดเลข ห้ามแต่งตัวเลขใหม่ ใช้เฉพาะตัวเลขที่ให้ไว้ด้านล่างนี้เท่านั้น
อ้างถึงตัวเลขได้ แต่ห้ามสร้างตัวเลขที่ไม่มีในข้อมูล

ข้อมูลของเดือนนี้ (คำนวณมาแล้ว):
${figuresBlock}

เขียนสรุปสั้นๆ กระชับ เป็นกันเอง ความยาวประมาณ 4-6 ประโยค ครอบคลุม:
1) เดือนนี้เป็นอย่างไรโดยรวม
2) เงินรั่วไหลตรงไหน (จากหมวดที่ใช้มาก/ส่วนต่างงบ)
3) ข้อเสนอแนะที่ทำได้จริง 2-3 ข้อ เพื่อให้ถึงเป้าหมายเร็วขึ้น
ตอบเป็นข้อความล้วน ไม่ต้องใส่ JSON`;

  let content: string;
  try {
    const res = await getGemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { temperature: 0.4 },
    });
    content = (res.text ?? "").trim();
  } catch (err) {
    return { status: "error", message: geminiErrorMessage(err) };
  }
  if (!content) {
    return { status: "error", message: "AI ไม่ตอบกลับ ลองใหม่อีกครั้ง" };
  }

  const saved = await prisma.insightSummary.upsert({
    where: { planId_month: { planId, month } },
    update: { content, generatedAt: new Date() },
    create: { planId, month, content },
  });

  revalidatePath(`/plans/${planId}`);
  return {
    status: "ok",
    content: saved.content,
    generatedAt: saved.generatedAt.toISOString(),
  };
}
