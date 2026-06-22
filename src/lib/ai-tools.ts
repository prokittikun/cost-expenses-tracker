import "server-only";
import { prisma } from "./prisma";
import {
  planSummary,
  projectCompletion,
  monthlyBuckets,
  monthKey,
  safeToSpend,
  type PlanWithMeta,
  type CalcCategory,
  type CalcTransaction,
} from "./calc";
import type { CategoryType } from "./categories";
import { formatMoney } from "./format";

// ── "Ask your data" read-only tools (Gemini function calling) ───────────────
//
// SECURITY INVARIANTS (must hold for every tool):
//  - userId ALWAYS comes from the server session, passed by the action loop —
//    never from model-provided arguments.
//  - Any planId the model passes is verified to belong to userId before use.
//  - All tools are READ-ONLY. No create/update/delete is ever exposed here.
//  - Transaction descriptions/notes are untrusted (prompt-injection surface);
//    we only ever return aggregates/figures, and ownership scoping is enforced
//    in SQL/where-clauses regardless of what such text says.

// Loads one owned plan as PlanWithMeta, or null if not owned by userId.
async function loadOwnedPlanWithMeta(
  userId: string,
  planId: string,
): Promise<PlanWithMeta | null> {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, userId }, // ← ownership enforced here
    include: {
      categories: true,
      transactions: { include: { category: { select: { type: true } } } },
    },
  });
  if (!plan) return null;
  return toPlanWithMeta(plan);
}

// All active+archived plans for the user as PlanWithMeta (for cross-plan tools).
async function loadAllOwnedPlansWithMeta(userId: string): Promise<PlanWithMeta[]> {
  const plans = await prisma.plan.findMany({
    where: { userId },
    orderBy: { targetDate: "asc" },
    include: {
      categories: true,
      transactions: { include: { category: { select: { type: true } } } },
    },
  });
  return plans.map(toPlanWithMeta);
}

type DbPlan = {
  id: string;
  name: string;
  currency: string;
  targetAmount: number;
  startDate: Date;
  targetDate: Date;
  categories: { id: string; name: string; type: string; plannedMonthly: number; sortOrder: number }[];
  transactions: { id: string; categoryId: string; date: Date; amount: number; category: { type: string } }[];
};

function toPlanWithMeta(plan: DbPlan): PlanWithMeta {
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
    type: t.category.type as CategoryType,
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

const isExpense = (t: CategoryType) => t === "FIXED" || t === "VARIABLE";

// A tool returns a plain JSON-serializable object handed back to the model as a
// functionResponse. Money fields are pre-formatted strings so the model never
// has to format/compute; raw numbers are included where useful for comparison.
export type ToolResult = Record<string, unknown>;

// Each tool: (userId, args) => result. Args come from the model and are treated
// as hints only; ownership/scoping is enforced inside.
export const AI_TOOLS: Record<
  string,
  (userId: string, args: Record<string, unknown>) => Promise<ToolResult>
> = {
  async listPlans(userId) {
    const plans = await loadAllOwnedPlansWithMeta(userId);
    return {
      plans: plans.map((p) => {
        const s = planSummary(p);
        const proj = projectCompletion(p);
        return {
          planId: p.id,
          name: p.name,
          currency: p.currency,
          target: formatMoney(p.targetAmount, p.currency),
          saved: formatMoney(s.savedSoFar, p.currency),
          progressPercent: Math.round(s.progress * 100),
          targetDate: p.targetDate.toISOString().slice(0, 10),
          status:
            proj.status === "complete"
              ? "ครบเป้าแล้ว"
              : proj.status === "no-pace"
                ? "ยังเก็บไม่พอจะคาดการณ์"
                : proj.daysVsTarget >= 0
                  ? `ตามแผน (เร็วกว่ากำหนด ${proj.daysVsTarget} วัน)`
                  : `ช้ากว่ากำหนด ${Math.abs(proj.daysVsTarget)} วัน`,
        };
      }),
    };
  },

  async getPlanProgress(userId, args) {
    const planId = String(args.planId ?? "");
    const plan = await loadOwnedPlanWithMeta(userId, planId);
    if (!plan) return { error: "ไม่พบเป้าหมายนี้ หรือไม่ใช่ของคุณ" };
    const s = planSummary(plan);
    const proj = projectCompletion(plan);
    return {
      planName: plan.name,
      saved: formatMoney(s.savedSoFar, plan.currency),
      remaining: formatMoney(s.remaining, plan.currency),
      progressPercent: Math.round(s.progress * 100),
      avgNeededPerMonth: formatMoney(s.avgNeededPerMonth, plan.currency),
      targetDate: plan.targetDate.toISOString().slice(0, 10),
      projectedDate:
        proj.status === "projecting"
          ? proj.projectedDate.toISOString().slice(0, 10)
          : null,
      onTrack:
        proj.status === "complete"
          ? true
          : proj.status === "projecting"
            ? proj.daysVsTarget >= 0
            : null,
      note:
        proj.status === "no-pace"
          ? "ยังเก็บเงินไม่พอจะคาดการณ์วันถึงเป้า"
          : proj.status === "complete"
            ? "ถึงเป้าแล้ว"
            : null,
    };
  },

  async getMonthlySummary(userId, args) {
    const planId = String(args.planId ?? "");
    const month = normalizeMonth(args.month);
    const plan = await loadOwnedPlanWithMeta(userId, planId);
    if (!plan) return { error: "ไม่พบเป้าหมายนี้ หรือไม่ใช่ของคุณ" };
    const bucket = monthlyBuckets(plan).find((b) => b.ym === month);
    const cur = plan.currency;

    // per-category totals for the month
    const perCat = new Map<string, number>();
    for (const t of plan.transactions) {
      if (monthKey(t.date) !== month) continue;
      perCat.set(t.categoryId, (perCat.get(t.categoryId) ?? 0) + t.amount);
    }
    const categories = plan.categories
      .map((c) => ({ name: c.name, type: c.type, amount: perCat.get(c.id) ?? 0 }))
      .filter((c) => c.amount > 0)
      .map((c) => ({
        name: c.name,
        type: c.type,
        amount: formatMoney(c.amount, cur),
      }));

    return {
      planName: plan.name,
      month,
      income: formatMoney(bucket?.income ?? 0, cur),
      expense: formatMoney(bucket?.expense ?? 0, cur),
      saving: formatMoney(bucket?.saving ?? 0, cur),
      net: formatMoney(bucket?.net ?? 0, cur),
      categories,
    };
  },

  async getTopCategories(userId, args) {
    const month = args.month ? normalizeMonth(args.month) : null;
    const n = clampInt(args.n, 1, 10, 5);
    const plans = await scopePlans(userId, args.planId);
    if (plans.length === 0) return { error: "ไม่พบเป้าหมาย" };

    const totals = new Map<string, number>();
    let grand = 0;
    for (const plan of plans) {
      for (const t of plan.transactions) {
        if (!isExpense(t.type)) continue;
        if (month && monthKey(t.date) !== month) continue;
        const cat = plan.categories.find((c) => c.id === t.categoryId);
        const key = cat?.name ?? "อื่นๆ";
        totals.set(key, (totals.get(key) ?? 0) + t.amount);
        grand += t.amount;
      }
    }
    const cur = plans[0].currency;
    const top = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, amount]) => ({
        name,
        amount: formatMoney(amount, cur),
        sharePercent: grand > 0 ? Math.round((amount / grand) * 100) : 0,
      }));
    return { month: month ?? "ทุกเดือน", totalExpense: formatMoney(grand, cur), top };
  },

  async searchTransactionsTotal(userId, args) {
    const keyword = String(args.keyword ?? "").trim();
    if (!keyword) return { error: "ต้องระบุคำค้น" };
    const month = args.month ? normalizeMonth(args.month) : null;
    const plans = await scopePlans(userId, args.planId);
    if (plans.length === 0) return { error: "ไม่พบเป้าหมาย" };
    const planIds = plans.map((p) => p.id);

    // Aggregate in the DB, scoped to the user's plans. We return SUM + count
    // only — never raw rows (descriptions are untrusted text).
    const where = {
      planId: { in: planIds },
      description: { contains: keyword, mode: "insensitive" as const },
      ...(month
        ? {
            date: {
              gte: new Date(`${month}-01T00:00:00`),
              lt: nextMonthStart(month),
            },
          }
        : {}),
    };
    const agg = await prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
    const cur = plans[0].currency;
    return {
      keyword,
      month: month ?? "ทุกเดือน",
      total: formatMoney(agg._sum.amount ?? 0, cur),
      count: agg._count._all,
    };
  },

  async getSpendingTrend(userId, args) {
    const from = args.fromMonth ? normalizeMonth(args.fromMonth) : null;
    const to = args.toMonth ? normalizeMonth(args.toMonth) : null;
    const plans = await scopePlans(userId, args.planId);
    if (plans.length === 0) return { error: "ไม่พบเป้าหมาย" };

    const byMonth = new Map<string, number>();
    for (const plan of plans) {
      for (const t of plan.transactions) {
        if (!isExpense(t.type)) continue;
        const ym = monthKey(t.date);
        if (from && ym < from) continue;
        if (to && ym > to) continue;
        byMonth.set(ym, (byMonth.get(ym) ?? 0) + t.amount);
      }
    }
    const cur = plans[0].currency;
    const months = Array.from(byMonth.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([ym, amount]) => ({ month: ym, expense: formatMoney(amount, cur) }));
    return { months };
  },

  async getSafeToSpend(userId, args) {
    const planId = String(args.planId ?? "");
    const plan = await loadOwnedPlanWithMeta(userId, planId);
    if (!plan) return { error: "ไม่พบเป้าหมายนี้ หรือไม่ใช่ของคุณ" };
    const s = safeToSpend(plan);
    const cur = plan.currency;
    return {
      planName: plan.name,
      plannedIncome: formatMoney(s.plannedIncome, cur),
      plannedFixed: formatMoney(s.plannedFixed, cur),
      savingTarget: formatMoney(s.savingTarget, cur),
      actualVariableThisMonth: formatMoney(s.actualVariable, cur),
      safeToSpend: formatMoney(s.safeToSpend, cur),
      safePerDay: formatMoney(s.safePerDay, cur),
      daysRemaining: s.daysRemaining,
      overspending: s.safeToSpend < 0,
    };
  },
};

// ── helpers ─────────────────────────────────────────────────────────────────

// planId optional: if present + owned → just that plan; if absent → all plans.
async function scopePlans(
  userId: string,
  planIdArg: unknown,
): Promise<PlanWithMeta[]> {
  const planId = planIdArg ? String(planIdArg) : "";
  if (planId) {
    const p = await loadOwnedPlanWithMeta(userId, planId);
    return p ? [p] : [];
  }
  return loadAllOwnedPlansWithMeta(userId);
}

// Accepts "YYYY-MM" (or coerces a date-ish string); falls back to current month.
function normalizeMonth(v: unknown): string {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return monthKey(d);
  return monthKey(new Date());
}

function nextMonthStart(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 1); // m is 1-based → Date month index gives next month
}

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Math.floor(Number(v));
  if (!isFinite(n)) return dflt;
  return Math.min(Math.max(n, min), max);
}
