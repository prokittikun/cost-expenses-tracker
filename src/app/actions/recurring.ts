"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, assertOwnsPlan } from "@/lib/data";
import { materializeRecurring } from "@/lib/recurring";
import { ok, fail, type ActionResult } from "@/lib/action-state";

function revalidatePlan(planId: string) {
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/plans/${planId}/log`);
  revalidatePath(`/plans/${planId}/summary`);
}

const createSchema = z
  .object({
    planId: z.string().min(1),
    categoryId: z.string().min(1),
    amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0"),
    description: z.string().trim().min(1, "ใส่รายละเอียด").max(200),
    dayOfMonth: z.coerce.number().int().min(1).max(31),
    startDate: z.coerce.date(),
    endDate: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.date().optional(),
    ),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    path: ["endDate"],
  });

export async function createRuleAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = createSchema.safeParse({
    planId: formData.get("planId"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    dayOfMonth: formData.get("dayOfMonth"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
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

  const rule = await prisma.recurringRule.create({
    data: {
      planId: d.planId,
      categoryId: d.categoryId,
      amount: d.amount,
      description: d.description,
      dayOfMonth: d.dayOfMonth,
      startDate: d.startDate,
      endDate: d.endDate ?? null,
    },
  });
  // Backfill immediately so the new rule's past/current entries appear at once.
  await materializeRecurring(d.planId, new Date(), rule.id);
  revalidatePlan(d.planId);
  return ok("เพิ่มรายการประจำแล้ว");
}

const updateSchema = z
  .object({
    planId: z.string().min(1),
    ruleId: z.string().min(1),
    categoryId: z.string().min(1),
    amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0"),
    description: z.string().trim().min(1, "ใส่รายละเอียด").max(200),
    dayOfMonth: z.coerce.number().int().min(1).max(31),
    startDate: z.coerce.date(),
    endDate: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.date().optional(),
    ),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    path: ["endDate"],
  });

export async function updateRuleAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = updateSchema.safeParse({
    planId: formData.get("planId"),
    ruleId: formData.get("ruleId"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    dayOfMonth: formData.get("dayOfMonth"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  }
  const d = parsed.data;
  await assertOwnsPlan(d.planId, userId);
  const rule = await prisma.recurringRule.findFirst({
    where: { id: d.ruleId, planId: d.planId },
    select: { id: true },
  });
  if (!rule) return fail("ไม่พบรายการประจำ");
  const cat = await prisma.category.findFirst({
    where: { id: d.categoryId, planId: d.planId },
    select: { id: true },
  });
  if (!cat) return fail("หมวดไม่ถูกต้อง");

  // Only the rule definition changes; already-generated transactions are left as-is
  // (they remain individually editable). Future months use the new values.
  await prisma.recurringRule.update({
    where: { id: d.ruleId },
    data: {
      categoryId: d.categoryId,
      amount: d.amount,
      description: d.description,
      dayOfMonth: d.dayOfMonth,
      startDate: d.startDate,
      endDate: d.endDate ?? null,
    },
  });
  revalidatePlan(d.planId);
  return ok("บันทึกรายการประจำแล้ว");
}

export async function toggleRuleActiveAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const planId = String(formData.get("planId"));
  const ruleId = String(formData.get("ruleId"));
  await assertOwnsPlan(planId, userId);
  const rule = await prisma.recurringRule.findFirst({
    where: { id: ruleId, planId },
    select: { active: true },
  });
  if (!rule) return fail("ไม่พบรายการประจำ");
  const active = !rule.active;
  await prisma.recurringRule.update({ where: { id: ruleId }, data: { active } });
  // Resuming a paused rule should backfill any months missed while paused.
  if (active) await materializeRecurring(planId, new Date(), ruleId);
  revalidatePlan(planId);
  return ok(active ? "เปิดใช้งานรายการประจำแล้ว" : "หยุดรายการประจำชั่วคราว");
}

export async function deleteRuleAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const planId = String(formData.get("planId"));
  const ruleId = String(formData.get("ruleId"));
  await assertOwnsPlan(planId, userId);
  // Generated transactions keep existing (sourceRuleId set null via onDelete: SetNull)
  // so history isn't lost when a rule is removed.
  await prisma.recurringRule.deleteMany({ where: { id: ruleId, planId } });
  revalidatePlan(planId);
  return ok("ลบรายการประจำแล้ว");
}

export async function generateNowAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const planId = String(formData.get("planId"));
  await assertOwnsPlan(planId, userId);
  const { created } = await materializeRecurring(planId);
  revalidatePlan(planId);
  return created > 0
    ? ok(`สร้างรายการประจำ ${created} รายการ`)
    : ok("ไม่มีรายการประจำที่ต้องสร้างเพิ่ม");
}
