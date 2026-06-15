import { loadOwnedPlan } from "@/lib/plan-view";
import {
  planSummary,
  budgetRollup,
  monthlyBuckets,
  monthRange,
} from "@/lib/calc";
import { Card, Stat, LinkButton } from "@/components/ui";
import { ProgressTrack } from "@/components/ProgressTrack";
import { SavingsChart } from "@/components/SavingsChart";
import { PlanSettings } from "./PlanSettings";
import { formatMoney, formatDate } from "@/lib/format";

export default async function PlanDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { plan, calc } = await loadOwnedPlan(id);

  const summary = planSummary(calc);
  const budget = budgetRollup(calc.categories);
  const buckets = monthlyBuckets(calc);
  const months = monthRange(plan.startDate, plan.targetDate);
  const cur = plan.currency;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs text-muted">ความคืบหน้า</div>
            <div className="text-3xl font-bold text-gold tabular">
              {Math.round(summary.progressCapped * 100)}%
            </div>
          </div>
          <div className="text-right text-sm text-muted">
            {formatDate(plan.startDate)} → {formatDate(plan.targetDate)}
          </div>
        </div>
        <div className="mt-4">
          <ProgressTrack
            months={months}
            progress={summary.progressCapped}
            currency={cur}
            targetAmount={plan.targetAmount}
          />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="เก็บได้แล้ว" value={formatMoney(summary.savedSoFar, cur)} accent="jade" />
          <Stat label="ยังต้องเก็บอีก" value={formatMoney(summary.remaining, cur)} accent="ink" />
          <Stat label="เดือนที่เหลือ" value={`${summary.monthsRemaining}`} accent="muted" />
          <Stat
            label="ต้องเก็บเฉลี่ย/เดือน"
            value={formatMoney(summary.avgNeededPerMonth, cur)}
            accent="gold"
          />
        </div>
      </Card>

      {/* Budget rollup */}
      <Card>
        <h2 className="font-semibold text-ink">สรุปงบตามแผน (ต่อเดือน)</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="รายรับ" value={formatMoney(budget.income, cur)} accent="jade" />
          <Stat label="จ่ายคงที่" value={formatMoney(budget.fixed, cur)} accent="ink" />
          <Stat label="จ่ายผันแปร" value={formatMoney(budget.variable, cur)} accent="ink" />
          <Stat label="เป้าเก็บ" value={formatMoney(budget.saving, cur)} accent="gold" />
          <Stat
            label="buffer"
            value={formatMoney(budget.buffer, cur)}
            accent={budget.buffer < 0 ? "warn" : "jade"}
          />
        </div>
        {budget.buffer < 0 && (
          <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
            งบติดลบ — รายจ่ายและเป้าเก็บรวมเกินรายรับต่อเดือน
          </p>
        )}
        <div className="mt-4">
          <LinkButton href={`/plans/${plan.id}/budget`} variant="outline">
            แก้งบประมาณ
          </LinkButton>
        </div>
      </Card>

      {/* Chart */}
      <Card>
        <h2 className="font-semibold text-ink">เงินสะสมตามเดือน</h2>
        <div className="mt-4">
          <SavingsChart
            data={buckets.map((b) => ({ ym: b.ym, cumulative: b.cumulativeSaving }))}
            targetAmount={plan.targetAmount}
            currency={cur}
          />
        </div>
      </Card>

      {/* Settings / archive / delete */}
      <PlanSettings
        plan={{
          id: plan.id,
          name: plan.name,
          description: plan.description,
          currency: plan.currency,
          targetAmount: plan.targetAmount,
          startDate: plan.startDate.toISOString(),
          targetDate: plan.targetDate.toISOString(),
          archived: plan.archived,
        }}
      />
    </div>
  );
}
