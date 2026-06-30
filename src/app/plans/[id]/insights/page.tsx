import { loadOwnedPlan } from "@/lib/plan-view";
import { categoryComparison, monthRange, monthKey } from "@/lib/calc";
import { Card } from "@/components/ui";
import { MonthSelect } from "@/components/MonthSelect";
import { CATEGORY_TYPE_LABEL, type CategoryType } from "@/lib/categories";
import { formatMoney, formatPercent, formatMonthLabel } from "@/lib/format";

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month } = await searchParams;
  const { plan, calc } = await loadOwnedPlan(id);

  const months = monthRange(plan.startDate, plan.targetDate);
  // default to current month if in range, else the latest month of the plan
  const current = monthKey(new Date());
  const fallback = months.includes(current) ? current : months[months.length - 1];
  const selected = month && months.includes(month) ? month : fallback;

  const rows = categoryComparison(calc, selected);
  const cur = plan.currency;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink">แผนเทียบกับจริง — รายหมวด</h2>
            <p className="mt-1 text-sm text-muted">
              เดือน {formatMonthLabel(selected)}
            </p>
          </div>
          <MonthSelect
            basePath={`/plans/${plan.id}/insights`}
            months={months}
            selected={selected}
          />
        </div>

        <div className="mt-4 space-y-3">
          {rows.map((r) => {
            const usedPct =
              r.usedRatio == null ? null : Math.round(r.usedRatio * 100);
            const barPct =
              r.planned > 0
                ? Math.max(Math.min((r.actual / r.planned) * 100, 100), 0)
                : 0;
            return (
              <div
                key={r.categoryId}
                className="rounded-lg border border-ink/10 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-ink">{r.name}</span>
                    <span className="ml-2 text-xs text-muted">
                      {CATEGORY_TYPE_LABEL[r.type as CategoryType]}
                    </span>
                  </div>
                  <div className="text-right text-sm tabular">
                    <span className={r.overBudget ? "text-warn" : "text-ink"}>
                      {formatMoney(r.actual, cur)}
                    </span>
                    <span className="text-muted"> / {formatMoney(r.planned, cur)}</span>
                  </div>
                </div>

                {/* planned vs actual bar */}
                <div className="mt-2 h-2 w-full rounded-full bg-ink/10">
                  <div
                    className={`h-2 rounded-full ${
                      r.overBudget ? "bg-warn" : "bg-jade"
                    }`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>

                <div className="mt-1 flex justify-between text-xs tabular">
                  <span
                    className={
                      r.variance > 0 && r.overBudget
                        ? "text-warn"
                        : r.variance < 0
                          ? "text-jade"
                          : "text-muted"
                    }
                  >
                    ส่วนต่าง {r.variance >= 0 ? "+" : ""}
                    {formatMoney(r.variance, cur)}
                  </span>
                  <span className="text-muted">
                    {usedPct == null
                      ? "ไม่ได้ตั้งงบ"
                      : `ใช้ไป ${formatPercent(r.usedRatio!)} ของงบ`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
