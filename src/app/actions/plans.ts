"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, assertOwnsPlan } from "@/lib/data";
import { getTemplate } from "@/lib/categories";
import { ok, fail, type ActionResult } from "@/lib/action-state";

const createSchema = z
  .object({
    name: z.string().trim().min(1, "ใส่ชื่อเป้าหมาย").max(120),
    description: z.string().trim().max(500).optional(),
    currency: z.string().trim().min(1).max(8).default("THB"),
    targetAmount: z.coerce.number().positive("ยอดเป้าต้องมากกว่า 0"),
    startDate: z.coerce.date(),
    targetDate: z.coerce.date(),
    template: z.string().default("general"),
  })
  .refine((d) => d.targetDate >= d.startDate, {
    message: "วันครบกำหนดต้องไม่ก่อนวันเริ่ม",
    path: ["targetDate"],
  });

export async function createPlanAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    currency: formData.get("currency") || "THB",
    targetAmount: formData.get("targetAmount"),
    startDate: formData.get("startDate"),
    targetDate: formData.get("targetDate"),
    template: formData.get("template") || "general",
  });
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  }
  const d = parsed.data;
  const tmpl = getTemplate(d.template) ?? getTemplate("general")!;

  const plan = await prisma.plan.create({
    data: {
      userId,
      name: d.name,
      description: d.description ?? "",
      currency: d.currency,
      targetAmount: d.targetAmount,
      startDate: d.startDate,
      targetDate: d.targetDate,
      categories: {
        create: tmpl.categories.map((c, i) => ({
          name: c.name,
          type: c.type,
          plannedMonthly: c.plannedMonthly,
          sortOrder: i,
        })),
      },
    },
  });

  redirect(`/plans/${plan.id}`);
}

const updateSchema = z
  .object({
    planId: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    currency: z.string().trim().min(1).max(8),
    targetAmount: z.coerce.number().positive(),
    startDate: z.coerce.date(),
    targetDate: z.coerce.date(),
  })
  .refine((d) => d.targetDate >= d.startDate, {
    message: "วันครบกำหนดต้องไม่ก่อนวันเริ่ม",
    path: ["targetDate"],
  });

export async function updatePlanAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = updateSchema.safeParse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    currency: formData.get("currency"),
    targetAmount: formData.get("targetAmount"),
    startDate: formData.get("startDate"),
    targetDate: formData.get("targetDate"),
  });
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  }
  const d = parsed.data;
  await assertOwnsPlan(d.planId, userId);

  await prisma.plan.update({
    where: { id: d.planId },
    data: {
      name: d.name,
      description: d.description ?? "",
      currency: d.currency,
      targetAmount: d.targetAmount,
      startDate: d.startDate,
      targetDate: d.targetDate,
    },
  });
  revalidatePath(`/plans/${d.planId}`);
  return ok("บันทึกการเปลี่ยนแปลงแล้ว");
}

export async function toggleArchiveAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const planId = String(formData.get("planId"));
  await assertOwnsPlan(planId, userId);
  const plan = await prisma.plan.findUniqueOrThrow({
    where: { id: planId },
    select: { archived: true },
  });
  const archived = !plan.archived;
  await prisma.plan.update({
    where: { id: planId },
    data: { archived },
  });
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  return ok(archived ? "เก็บถาวรแล้ว" : "เลิกเก็บถาวรแล้ว");
}

export async function deletePlanAction(formData: FormData) {
  const userId = await requireUserId();
  const planId = String(formData.get("planId"));
  await assertOwnsPlan(planId, userId);
  await prisma.plan.delete({ where: { id: planId } });
  redirect("/plans");
}
