import Link from "next/link";
import { requireUserId, getActiveUserPlansFull } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { crossPlanOverview, type PlanWithMeta } from "@/lib/calc";
import type { CategoryType } from "@/lib/categories";
import { Card, Stat, LinkButton } from "@/components/ui";
import { AskDataChat } from "@/components/AskDataChat";
import { isGeminiConfigured } from "@/lib/gemini";
import { formatMoney, formatDate, formatPercent } from "@/lib/format";

export default async function OverviewPage() {
  const userId = await requireUserId();
  const plans = await getActiveUserPlansFull(userId);
  const aiUser = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { aiOptIn: true },
  });
  const aiChat = isGeminiConfigured() ? (
    <AskDataChat scopePlanId={null} optedIn={aiUser.aiOptIn} />
  ) : null;

  const planInputs: PlanWithMeta[] = plans.map((p) => {
    const catType = new Map<string, CategoryType>(
      p.categories.map((c) => [c.id, c.type as CategoryType]),
    );
    return {
      id: p.id,
      name: p.name,
      currency: p.currency,
      targetAmount: p.targetAmount,
      startDate: p.startDate,
      targetDate: p.targetDate,
      categories: p.categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type as CategoryType,
        plannedMonthly: c.plannedMonthly,
        sortOrder: c.sortOrder,
      })),
      transactions: p.transactions.map((t) => ({
        id: t.id,
        categoryId: t.categoryId,
        type: t.category.type as CategoryType,
        date: t.date,
        amount: t.amount,
      })),
    };
  });

  const o = crossPlanOverview(planInputs);
  // For mixed currencies, cross-plan money sums are shown with the first plan's
  // currency as a display unit (THB by default). Per-card values use their own.
  const baseCur = planInputs[0]?.currency ?? "THB";

  if (o.planCount === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ink">ภาพรวมเป้าหมาย</h1>
        <Card className="mt-6 text-center">
          <p className="text-muted">ยังไม่มีเป้าหมายที่กำลังดำเนินการ</p>
          <div className="mt-4">
            <LinkButton href="/plans/new" variant="gold">
              สร้างเป้าหมายแรก
            </LinkButton>
          </div>
        </Card>
        {aiChat}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">ภาพรวมเป้าหมาย</h1>
          <p className="mt-1 text-sm text-muted">
            {o.planCount} เป้าหมายที่กำลังดำเนินการ
          </p>
        </div>
        <LinkButton href="/plans/new" variant="gold">
          + สร้างเป้าหมาย
        </LinkButton>
      </div>

      {/* Combined totals */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs text-muted">ความคืบหน้ารวมทุกเป้าหมาย</div>
            <div className="text-3xl font-bold text-gold tabular">
              {Math.round(o.overallProgress * 100)}%
            </div>
          </div>
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-ink/10">
          <div
            className="h-2 rounded-full bg-gold"
            style={{ width: `${Math.round(o.overallProgress * 100)}%` }}
          />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="เก็บได้แล้วรวม" value={formatMoney(o.totalSaved, baseCur)} accent="jade" />
          <Stat label="เป้าหมายรวม" value={formatMoney(o.totalTarget, baseCur)} accent="ink" />
          <Stat
            label="ต้องเก็บรวม/เดือน"
            value={formatMoney(o.requiredPerMonth, baseCur)}
            accent="gold"
          />
        </div>
      </Card>

      {/* Funding capacity check */}
      <Card>
        <h2 className="font-semibold text-ink">กำลังในการเก็บเงิน</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Stat
            label="ต้องเก็บรวม/เดือน"
            value={formatMoney(o.requiredPerMonth, baseCur)}
            accent="ink"
          />
          <Stat
            label="เก็บจริงเฉลี่ย/เดือน (3 เดือนล่าสุด)"
            value={formatMoney(o.actualMonthlySaving, baseCur)}
            accent={o.overCommitted ? "warn" : "jade"}
          />
        </div>
        {o.overCommitted ? (
          <div className="mt-4 rounded-lg bg-warn/10 px-3 py-3 text-sm text-warn">
            <span className="font-semibold">เก็บไม่ทันทุกเป้าหมาย</span> — ด้วยอัตราเก็บ
            ปัจจุบัน ยังขาดอีก{" "}
            <span className="font-semibold tabular">
              {formatMoney(o.shortfall, baseCur)}/เดือน
            </span>{" "}
            ลองเพิ่มเงินเก็บ เลื่อนกำหนด หรือลดเป้าหมายบางอัน
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-jade/10 px-3 py-3 text-sm text-jade">
            อัตราเก็บปัจจุบันเพียงพอสำหรับทุกเป้าหมายตามกำหนด
          </div>
        )}
      </Card>

      {/* Per-plan cards, soonest deadline first */}
      <div className="grid gap-4 sm:grid-cols-2">
        {o.cards.map((c) => (
          <Link key={c.id} href={`/plans/${c.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-ink">{c.name}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.onTrack ? "bg-jade/10 text-jade" : "bg-warn/10 text-warn"
                  }`}
                >
                  {c.onTrack ? "ตามแผน" : "ช้ากว่ากำหนด"}
                </span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-ink/10">
                <div
                  className="h-2 rounded-full bg-gold"
                  style={{ width: `${Math.round(c.progress * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="font-medium text-gold tabular">
                  {formatPercent(c.progress)}
                </span>
                <span className="text-muted tabular">
                  {formatMoney(c.savedSoFar, c.currency)} /{" "}
                  {formatMoney(c.targetAmount, c.currency)}
                </span>
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted tabular">
                <span>ครบกำหนด {formatDate(c.targetDate)}</span>
                <span>ต้องเก็บ {formatMoney(c.avgNeededPerMonth, c.currency)}/เดือน</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      {aiChat}
    </div>
  );
}
