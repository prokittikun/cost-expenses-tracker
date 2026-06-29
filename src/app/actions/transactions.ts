"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, assertOwnsPlan } from "@/lib/data";
import { ok, fail, type ActionResult } from "@/lib/action-state";
import { monthKey } from "@/lib/calc";

const withdrawSchema = z.object({
  planId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0"),
  description: z.string().trim().min(1, "ใส่เหตุผล").max(200),
  note: z.string().trim().max(500).optional(),
});

// Withdraw money out of the goal's savings pot. Stored as a SAVING-category
// transaction with isWithdrawal=true (amount positive; calc subtracts it).
export async function withdrawFromGoalAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = withdrawSchema.safeParse({
    planId: formData.get("planId"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  }
  const d = parsed.data;
  await assertOwnsPlan(d.planId, userId);

  // Withdrawals attach to the plan's savings category (the pot). Pick the first
  // SAVING category by order; a goal always has at least one from its template.
  const savingCat = await prisma.category.findFirst({
    where: { planId: d.planId, type: "SAVING" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (!savingCat) {
    return fail("เป้าหมายนี้ยังไม่มีหมวดเงินเก็บ");
  }

  await prisma.transaction.create({
    data: {
      planId: d.planId,
      categoryId: savingCat.id,
      date: d.date,
      amount: d.amount,
      description: d.description,
      note: d.note ?? "",
      isWithdrawal: true,
    },
  });
  revalidatePath(`/plans/${d.planId}`);
  revalidatePath(`/plans/${d.planId}/log`);
  revalidatePath(`/plans/${d.planId}/summary`);
  return ok("บันทึกการเบิกเงินแล้ว");
}

const addSchema = z.object({
  planId: z.string().min(1),
  categoryId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0"),
  description: z.string().trim().min(1, "ใส่รายละเอียด").max(200),
  note: z.string().trim().max(500).optional(),
});

// Find a category in `targetPlanId` matching (name, type); create it if missing
// so a mirrored transaction always has a home category in the other goal.
async function ensureCategory(
  targetPlanId: string,
  name: string,
  type: string,
): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { planId: targetPlanId, name },
    select: { id: true, type: true },
  });
  if (existing) return existing.id;
  const max = await prisma.category.aggregate({
    where: { planId: targetPlanId },
    _max: { sortOrder: true },
  });
  const created = await prisma.category.create({
    data: {
      planId: targetPlanId,
      name,
      type,
      plannedMonthly: 0,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });
  return created.id;
}

export async function addTransactionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = addSchema.safeParse({
    planId: formData.get("planId"),
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  }
  const d = parsed.data;
  await assertOwnsPlan(d.planId, userId);
  // category must belong to this plan
  const cat = await prisma.category.findFirst({
    where: { id: d.categoryId, planId: d.planId },
    select: { id: true, name: true, type: true },
  });
  if (!cat) return fail("หมวดไม่ถูกต้อง");

  // Optional sync: mirror this row into other goals. Only for non-SAVING
  // (savings allocation is per-goal). Verify each target belongs to the user.
  let syncTargets: string[] = [];
  if (cat.type !== "SAVING") {
    const requested = formData
      .getAll("syncPlanIds")
      .map(String)
      .filter((id) => id && id !== d.planId);
    if (requested.length > 0) {
      const owned = await prisma.plan.findMany({
        where: { id: { in: requested }, userId },
        select: { id: true },
      });
      syncTargets = owned.map((p) => p.id);
    }
  }

  const syncGroupId = syncTargets.length > 0 ? crypto.randomUUID() : null;

  await prisma.transaction.create({
    data: {
      planId: d.planId,
      categoryId: d.categoryId,
      date: d.date,
      amount: d.amount,
      description: d.description,
      note: d.note ?? "",
      syncGroupId,
    },
  });

  // Create the mirrored copies in each target goal, sharing syncGroupId.
  for (const targetPlanId of syncTargets) {
    const targetCatId = await ensureCategory(targetPlanId, cat.name, cat.type);
    await prisma.transaction.create({
      data: {
        planId: targetPlanId,
        categoryId: targetCatId,
        date: d.date,
        amount: d.amount,
        description: d.description,
        note: d.note ?? "",
        syncGroupId,
      },
    });
    revalidatePath(`/plans/${targetPlanId}/log`);
    revalidatePath(`/plans/${targetPlanId}`);
    revalidatePath(`/plans/${targetPlanId}/summary`);
  }

  revalidatePath(`/plans/${d.planId}/log`);
  revalidatePath(`/plans/${d.planId}`);
  revalidatePath(`/plans/${d.planId}/summary`);
  return ok(
    syncTargets.length > 0
      ? `บันทึกแล้ว + ซิงค์ไป ${syncTargets.length} เป้าหมาย`
      : "บันทึกรายการแล้ว",
  );
}

export async function deleteTransactionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const planId = String(formData.get("planId"));
  const txId = String(formData.get("txId"));
  await assertOwnsPlan(planId, userId);

  // Fetch first so we can tell whether this row came from a recurring rule
  // and whether it's part of a cross-goal sync group.
  const tx = await prisma.transaction.findFirst({
    where: { id: txId, planId },
    select: { id: true, sourceRuleId: true, date: true, syncGroupId: true },
  });
  if (!tx) return fail("ไม่พบรายการ");

  let synced = 0;
  if (tx.syncGroupId) {
    // Deleting one synced copy deletes the whole group — but only across plans
    // the user owns (defense in depth; groups never span users anyway).
    const ownedPlanIds = (
      await prisma.plan.findMany({ where: { userId }, select: { id: true } })
    ).map((p) => p.id);
    const group = await prisma.transaction.findMany({
      where: { syncGroupId: tx.syncGroupId, planId: { in: ownedPlanIds } },
      select: { id: true, planId: true },
    });
    await prisma.transaction.deleteMany({
      where: { id: { in: group.map((g) => g.id) } },
    });
    synced = group.length;
    for (const g of group) {
      revalidatePath(`/plans/${g.planId}/log`);
      revalidatePath(`/plans/${g.planId}`);
      revalidatePath(`/plans/${g.planId}/summary`);
    }
  } else {
    await prisma.transaction.delete({ where: { id: tx.id } });
  }

  // If it was generated from a rule, remember the (rule, month) so lazy
  // materialization won't recreate it on the next load.
  if (tx.sourceRuleId) {
    const ym = monthKey(tx.date);
    await prisma.recurringSkip.upsert({
      where: { ruleId_ym: { ruleId: tx.sourceRuleId, ym } },
      update: {},
      create: { ruleId: tx.sourceRuleId, ym },
    });
  }

  revalidatePath(`/plans/${planId}/log`);
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/summary`);
  return ok(
    synced > 1 ? `ลบรายการที่ซิงค์แล้ว (${synced} เป้าหมาย)` : "ลบรายการแล้ว",
  );
}
