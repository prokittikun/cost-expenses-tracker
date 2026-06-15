import { loadOwnedPlan } from "@/lib/plan-view";
import { variableTrend } from "@/lib/calc";
import { Card } from "@/components/ui";
import { VariableTrendChart } from "@/components/VariableTrendChart";

export default async function TrendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { plan, calc } = await loadOwnedPlan(id);
  const trend = variableTrend(calc);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-semibold text-ink">เทรนด์รายจ่ายผันแปร</h2>
        <p className="mt-1 text-sm text-muted">
          รายจ่ายประเภทผันแปร (VARIABLE) ในแต่ละเดือนตลอดช่วงของแผน
        </p>
        {trend.perCategory.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            แผนนี้ยังไม่มีหมวดรายจ่ายผันแปร
          </p>
        ) : (
          <div className="mt-2">
            <VariableTrendChart data={trend} currency={plan.currency} />
          </div>
        )}
      </Card>
    </div>
  );
}
