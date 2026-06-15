import { loadOwnedPlan } from "@/lib/plan-view";
import {
  monthlyBuckets,
  monthRange,
  categoryMonthlyTotals,
} from "@/lib/calc";
import { Card } from "@/components/ui";
import { formatMoney, formatMonthLabel } from "@/lib/format";
import type { CategoryType } from "@/lib/categories";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { plan, calc } = await loadOwnedPlan(id);

  const months = monthRange(plan.startDate, plan.targetDate);
  const buckets = monthlyBuckets(calc);
  const catTotals = categoryMonthlyTotals(calc);
  const cur = plan.currency;

  // expense categories (FIXED + VARIABLE) get their own rows
  const expenseCats = calc.categories.filter(
    (c) => c.type === ("FIXED" as CategoryType) || c.type === ("VARIABLE" as CategoryType),
  );

  const cell = "px-3 py-2 text-right tabular whitespace-nowrap";
  const head = "px-3 py-2 text-right text-xs font-medium text-muted whitespace-nowrap";

  return (
    <Card>
      <h2 className="font-semibold text-ink">สรุปรายเดือน</h2>
      <p className="mt-1 text-sm text-muted">
        ทุกเดือนตั้งแต่ {formatMonthLabel(months[0])} ถึง{" "}
        {formatMonthLabel(months[months.length - 1])}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted">
                รายการ
              </th>
              {months.map((m) => (
                <th key={m} className={head}>
                  {formatMonthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-ink/5">
              <td className="px-3 py-2 font-medium text-jade">รายรับรวม</td>
              {buckets.map((b) => (
                <td key={b.ym} className={`${cell} text-jade`}>
                  {formatMoney(b.income, cur)}
                </td>
              ))}
            </tr>

            {expenseCats.map((c) => {
              const byMonth = catTotals.get(c.id);
              return (
                <tr key={c.id} className="border-b border-ink/5">
                  <td className="px-3 py-2 pl-6 text-muted">{c.name}</td>
                  {months.map((m) => (
                    <td key={m} className={cell}>
                      {formatMoney(byMonth?.get(m) ?? 0, cur)}
                    </td>
                  ))}
                </tr>
              );
            })}

            <tr className="border-b border-ink/5">
              <td className="px-3 py-2 font-medium text-ink">รวมรายจ่าย</td>
              {buckets.map((b) => (
                <td key={b.ym} className={cell}>
                  {formatMoney(b.expense, cur)}
                </td>
              ))}
            </tr>

            <tr className="border-b border-ink/5">
              <td className="px-3 py-2 font-medium text-gold">เก็บเข้าเป้าหมาย</td>
              {buckets.map((b) => (
                <td key={b.ym} className={`${cell} text-gold`}>
                  {formatMoney(b.saving, cur)}
                </td>
              ))}
            </tr>

            <tr className="border-b border-ink/5">
              <td className="px-3 py-2 font-medium text-ink">คงเหลือสิ้นเดือน</td>
              {buckets.map((b) => (
                <td
                  key={b.ym}
                  className={`${cell} ${b.net < 0 ? "text-warn" : "text-ink"}`}
                >
                  {formatMoney(b.net, cur)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="px-3 py-2 font-semibold text-ink">เงินสะสม</td>
              {buckets.map((b) => (
                <td key={b.ym} className={`${cell} font-semibold text-gold`}>
                  {formatMoney(b.cumulativeSaving, cur)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
