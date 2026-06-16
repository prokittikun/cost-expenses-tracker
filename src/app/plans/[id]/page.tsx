import { loadOwnedPlan } from "@/lib/plan-view";
import {
  planSummary,
  budgetRollup,
  monthlyBuckets,
  monthRange,
  projectCompletion,
  milestones,
  savingStreak,
  newlyReachedMilestones,
  safeToSpend,
  spendingInsights,
} from "@/lib/calc";
import { Card, Stat, LinkButton } from "@/components/ui";
import { ProgressTrack } from "@/components/ProgressTrack";
import { SavingsChart } from "@/components/SavingsChart";
import { MilestoneCelebration } from "@/components/MilestoneCelebration";
import { PlanSettings } from "./PlanSettings";
import { CoachSummary } from "./CoachSummary";
import { getCoachState } from "@/app/actions/ai";
import { formatMoney, formatDate, formatPercent } from "@/lib/format";

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
  const projection = projectCompletion(calc);
  const planMilestones = milestones(calc);
  const streak = savingStreak(calc);
  const newlyReached = newlyReachedMilestones(calc, plan.celebratedMilestones);
  const safe = safeToSpend(calc);
  const insights = spendingInsights(calc);
  const coach = await getCoachState(plan.id);
  const cur = plan.currency;

  return (
    <div className="space-y-6">
      <MilestoneCelebration planId={plan.id} newlyReached={newlyReached} />

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

      {/* Safe-to-spend this month */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs text-muted">ใช้จ่ายได้อีกเดือนนี้ (ผันแปร)</div>
            <div
              className={`text-3xl font-bold tabular ${
                safe.safeToSpend >= 0 ? "text-jade" : "text-warn"
              }`}
            >
              {formatMoney(safe.safeToSpend, cur)}
            </div>
            <div className="mt-1 text-xs text-muted tabular">
              เฉลี่ยได้อีก {formatMoney(safe.safePerDay, cur)}/วัน ·
              เหลือ {safe.daysRemaining} วัน
            </div>
          </div>
          {safe.safeToSpend < 0 && (
            <div className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
              ใช้เกินงบ — กำลังกินเงินเก็บ
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="รายรับตามแผน" value={formatMoney(safe.plannedIncome, cur)} accent="jade" />
          <Stat label="จ่ายคงที่" value={formatMoney(safe.plannedFixed, cur)} accent="ink" />
          <Stat label="เป้าเก็บ" value={formatMoney(safe.savingTarget, cur)} accent="gold" />
          <Stat
            label="จ่ายผันแปรแล้วเดือนนี้"
            value={formatMoney(safe.actualVariable, cur)}
            accent="ink"
          />
        </div>
      </Card>

      {/* Behavioral spending insights */}
      <Card>
        <h2 className="font-semibold text-ink">พฤติกรรมการใช้จ่ายเดือนนี้</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted">เทียบเดือนก่อน</div>
            {insights.momChangeRatio == null ? (
              <div className="mt-1 text-sm text-muted">ไม่มีข้อมูลเดือนก่อน</div>
            ) : (
              <div
                className={`mt-1 text-xl font-semibold tabular ${
                  insights.momChangeRatio > 0 ? "text-warn" : "text-jade"
                }`}
              >
                {insights.momChangeRatio > 0 ? "▲" : "▼"}{" "}
                {formatPercent(Math.abs(insights.momChangeRatio))}
                <span className="ml-1 text-xs font-normal text-muted">
                  {insights.momChangeRatio > 0 ? "ใช้มากขึ้น" : "ใช้น้อยลง"}
                </span>
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted">หมวดที่ใช้มากสุด</div>
            {insights.topCategory ? (
              <div className="mt-1">
                <div className="text-xl font-semibold text-ink tabular">
                  {formatMoney(insights.topCategory.amount, cur)}
                </div>
                <div className="text-xs text-muted">
                  {insights.topCategory.name} ·{" "}
                  {formatPercent(insights.topCategory.share)} ของรายจ่าย
                </div>
              </div>
            ) : (
              <div className="mt-1 text-sm text-muted">ยังไม่มีรายจ่าย</div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted">ใช้จ่ายเฉลี่ย/วัน</div>
            <div className="mt-1 text-xl font-semibold text-ink tabular">
              {formatMoney(insights.avgDaily, cur)}
            </div>
            <div className="text-xs text-muted">
              รวมเดือนนี้ {formatMoney(insights.monthTotal, cur)}
            </div>
          </div>
        </div>
      </Card>

      {/* AI coach summary (Gemini) */}
      <CoachSummary
        planId={plan.id}
        configured={coach.configured}
        optedIn={coach.optedIn}
        content={coach.content}
        generatedAt={coach.generatedAt}
        month={coach.month}
      />

      {/* Projected completion (Feature 2) */}
      <Card>
        <h2 className="font-semibold text-ink">คาดการณ์วันถึงเป้า</h2>
        {projection.status === "complete" ? (
          <p className="mt-2 rounded-lg bg-jade/10 px-3 py-2 text-sm font-medium text-jade">
            🎉 เก็บครบเป้าหมายแล้ว
          </p>
        ) : projection.status === "no-pace" ? (
          <p className="mt-2 text-sm text-muted">
            ยังเก็บเงินไม่พอจะคาดการณ์ได้ — เริ่มบันทึกการเก็บเงินก่อน
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted">คาดว่าจะถึงเป้าวันที่</div>
              <div className="text-xl font-semibold text-ink tabular">
                {formatDate(projection.projectedDate)}
              </div>
              <div className="mt-1 text-xs text-muted tabular">
                อิงอัตราเก็บเฉลี่ย {formatMoney(projection.pace, cur)}/เดือน ·
                กำหนด {formatDate(plan.targetDate)}
              </div>
            </div>
            <div
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                projection.daysVsTarget >= 0
                  ? "bg-jade/10 text-jade"
                  : "bg-warn/10 text-warn"
              }`}
            >
              {projection.daysVsTarget >= 0
                ? `เร็วกว่ากำหนด ${projection.daysVsTarget} วัน`
                : `ช้ากว่ากำหนด ${Math.abs(projection.daysVsTarget)} วัน`}
            </div>
          </div>
        )}
      </Card>

      {/* Milestones + streak (Feature 3) */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">หมุดหมายความคืบหน้า</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">เก็บต่อเนื่อง</span>
            <span className="rounded-full bg-gold/15 px-2.5 py-1 font-semibold text-gold tabular">
              🔥 {streak} เดือน
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {planMilestones.map((m) => (
            <div
              key={m.percent}
              className={`rounded-xl border px-2 py-3 text-center ${
                m.reached
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-ink/10 bg-paper text-muted"
              }`}
            >
              <div className="text-lg font-bold tabular">{m.percent}%</div>
              <div className="text-[11px]">{m.reached ? "ถึงแล้ว" : "ยังไม่ถึง"}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          สตรีค = จำนวนเดือนติดต่อกัน (นับจากเดือนล่าสุดที่มีข้อมูล)
          ที่เก็บเงินได้ถึงเป้าต่อเดือน
        </p>
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
