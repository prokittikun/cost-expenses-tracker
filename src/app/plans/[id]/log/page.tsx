import { loadOwnedPlan } from "@/lib/plan-view";
import { requireUserId, getOwnedPlanRules } from "@/lib/data";
import { LogClient } from "./LogClient";
import { RecurringManager } from "./RecurringManager";
import { AiQuickEntry } from "./AiQuickEntry";
import { isGeminiConfigured } from "@/lib/gemini";
import type { CategoryType } from "@/lib/categories";
import { toDateInputValue } from "@/lib/format";

export default async function LogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // loadOwnedPlan materializes due recurring entries before reading transactions.
  const { plan } = await loadOwnedPlan(id);
  const userId = await requireUserId();
  const rules = (await getOwnedPlanRules(id, userId)) ?? [];

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
    createdAt: t.createdAt.toISOString(),
    amount: t.amount,
    description: t.description,
    note: t.note,
    fromRule: t.sourceRuleId != null,
    isWithdrawal: t.isWithdrawal,
  }));

  const ruleViews = rules.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    amount: r.amount,
    description: r.description,
    dayOfMonth: r.dayOfMonth,
    startDate: toDateInputValue(r.startDate),
    endDate: r.endDate ? toDateInputValue(r.endDate) : "",
    active: r.active,
    generatedCount: r._count.transactions,
  }));

  return (
    <div className="space-y-6">
      {isGeminiConfigured() && (
        <AiQuickEntry planId={plan.id} categories={categories} />
      )}
      <RecurringManager
        planId={plan.id}
        currency={plan.currency}
        categories={categories}
        rules={ruleViews}
      />
      <LogClient
        planId={plan.id}
        currency={plan.currency}
        categories={categories}
        transactions={transactions}
        aiEnabled={isGeminiConfigured()}
      />
    </div>
  );
}
