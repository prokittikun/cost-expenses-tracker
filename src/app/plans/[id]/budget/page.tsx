import { loadOwnedPlan } from "@/lib/plan-view";
import { budgetRollup } from "@/lib/calc";
import { BudgetEditor } from "./BudgetEditor";

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { plan, calc } = await loadOwnedPlan(id);
  const budget = budgetRollup(calc.categories);

  return (
    <BudgetEditor
      planId={plan.id}
      currency={plan.currency}
      categories={calc.categories}
      budget={budget}
    />
  );
}
