import { loadOwnedPlan } from "@/lib/plan-view";
import { LogClient } from "./LogClient";
import type { CategoryType } from "@/lib/categories";

export default async function LogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { plan } = await loadOwnedPlan(id);

  const categories = plan.categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type as CategoryType,
  }));

  const transactions = plan.transactions.map((t) => ({
    id: t.id,
    categoryId: t.categoryId,
    categoryName: t.category.name,
    type: t.category.type as CategoryType,
    date: t.date.toISOString(),
    amount: t.amount,
    description: t.description,
    note: t.note,
  }));

  return (
    <LogClient
      planId={plan.id}
      currency={plan.currency}
      categories={categories}
      transactions={transactions}
    />
  );
}
