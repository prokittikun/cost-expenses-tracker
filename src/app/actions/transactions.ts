"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, assertOwnsPlan } from "@/lib/data";
import { ok, fail, type ActionResult } from "@/lib/action-state";

const addSchema = z.object({
  planId: z.string().min(1),
  categoryId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0"),
  description: z.string().trim().min(1, "ใส่รายละเอียด").max(200),
  note: z.string().trim().max(500).optional(),
});

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
    select: { id: true },
  });
  if (!cat) return fail("หมวดไม่ถูกต้อง");

  await prisma.transaction.create({
    data: {
      planId: d.planId,
      categoryId: d.categoryId,
      date: d.date,
      amount: d.amount,
      description: d.description,
      note: d.note ?? "",
    },
  });
  revalidatePath(`/plans/${d.planId}/log`);
  revalidatePath(`/plans/${d.planId}`);
  revalidatePath(`/plans/${d.planId}/summary`);
  return ok("บันทึกรายการแล้ว");
}

export async function deleteTransactionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const planId = String(formData.get("planId"));
  const txId = String(formData.get("txId"));
  await assertOwnsPlan(planId, userId);
  await prisma.transaction.deleteMany({ where: { id: txId, planId } });
  revalidatePath(`/plans/${planId}/log`);
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/summary`);
  return ok("ลบรายการแล้ว");
}
