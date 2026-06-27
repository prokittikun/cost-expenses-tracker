import "server-only";
import { notFound } from "next/navigation";
import { requireUserId, getOwnedPlan, type OwnedPlan } from "./data";
import { prisma } from "./prisma";
import { materializeRecurring } from "./recurring";
import type { CalcCategory, CalcTransaction, PlanInput } from "./calc";
import type { CategoryType } from "./categories";

// Loads a plan owned by the session user (404 if missing/forbidden) and shapes it
// into the pure calc input. Single source for every /plans/[id]/* page.
//
// `materialize` (default true) runs lazy recurring-rule generation before reading
// transactions, so any due recurring entries are present in the returned data.
// Pages that don't show transactions can pass false to skip the extra work.
export async function loadOwnedPlan(
  planId: string,
  { materialize = true }: { materialize?: boolean } = {},
): Promise<{
  plan: OwnedPlan;
  calc: PlanInput;
}> {
  const userId = await requireUserId();

  if (materialize) {
    // Confirm ownership before generating anything, then materialize due entries.
    const owned = await prisma.plan.findFirst({
      where: { id: planId, userId },
      select: { id: true },
    });
    if (!owned) notFound();
    await materializeRecurring(planId);
  }

  const plan = await getOwnedPlan(planId, userId);
  if (!plan) notFound();

  const catType = new Map<string, CategoryType>(
    plan.categories.map((c) => [c.id, c.type as CategoryType]),
  );

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
    type: catType.get(t.categoryId) ?? "VARIABLE",
    date: t.date,
    amount: t.amount,
    isWithdrawal: t.isWithdrawal,
  }));

  return {
    plan,
    calc: {
      targetAmount: plan.targetAmount,
      startDate: plan.startDate,
      targetDate: plan.targetDate,
      categories,
      transactions,
    },
  };
}
