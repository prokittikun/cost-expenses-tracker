import "server-only";
import { auth } from "./auth";
import { prisma } from "./prisma";

// Every read/write goes through here so resources are always scoped to the session user.
// Never trust a userId/planId from the client without this check (CLAUDE.md §4).

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  return session.user.id;
}

export async function getUserPlans(userId: string) {
  return prisma.plan.findMany({
    where: { userId },
    orderBy: [{ archived: "asc" }, { createdAt: "desc" }],
    include: {
      categories: true,
      transactions: { select: { amount: true, categoryId: true } },
    },
  });
}

// Returns the plan only if it belongs to userId, else null. Use everywhere a planId
// arrives from the client.
export async function getOwnedPlan(planId: string, userId: string) {
  return prisma.plan.findFirst({
    where: { id: planId, userId },
    include: {
      categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      transactions: {
        include: { category: true },
        orderBy: { date: "desc" },
      },
    },
  });
}

export async function assertOwnsPlan(planId: string, userId: string) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!plan) throw new Error("FORBIDDEN");
  return plan.id;
}

export type OwnedPlan = NonNullable<Awaited<ReturnType<typeof getOwnedPlan>>>;

// Recurring rules for a plan owned by the user, newest first, with category info
// and a count of generated transactions.
export async function getOwnedPlanRules(planId: string, userId: string) {
  const owned = await prisma.plan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!owned) return null;
  return prisma.recurringRule.findMany({
    where: { planId },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { id: true, name: true, type: true } },
      _count: { select: { transactions: true } },
    },
  });
}
