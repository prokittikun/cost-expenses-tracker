"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId, assertOwnsPlan } from "@/lib/data";
import { CATEGORY_TYPES } from "@/lib/categories";
import { ok, fail, type ActionResult } from "@/lib/action-state";

const addSchema = z.object({
  planId: z.string().min(1),
  name: z.string().trim().min(1, "ใส่ชื่อหมวด").max(60),
  type: z.enum(CATEGORY_TYPES),
  plannedMonthly: z.coerce.number().min(0).default(0),
});

export async function addCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = addSchema.safeParse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    type: formData.get("type"),
    plannedMonthly: formData.get("plannedMonthly") || 0,
  });
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  }
  const d = parsed.data;
  await assertOwnsPlan(d.planId, userId);

  const max = await prisma.category.aggregate({
    where: { planId: d.planId },
    _max: { sortOrder: true },
  });

  try {
    await prisma.category.create({
      data: {
        planId: d.planId,
        name: d.name,
        type: d.type,
        plannedMonthly: d.plannedMonthly,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("มีหมวดชื่อนี้แล้ว");
    }
    throw e;
  }
  revalidatePath(`/plans/${d.planId}/budget`);
  return ok(`เพิ่มหมวด "${d.name}" แล้ว`);
}

const updateSchema = z.object({
  planId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  type: z.enum(CATEGORY_TYPES),
  plannedMonthly: z.coerce.number().min(0),
});

export async function updateCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = updateSchema.safeParse({
    planId: formData.get("planId"),
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    type: formData.get("type"),
    plannedMonthly: formData.get("plannedMonthly"),
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
  if (!cat) return fail("ไม่พบหมวด");

  try {
    await prisma.category.update({
      where: { id: d.categoryId },
      data: { name: d.name, type: d.type, plannedMonthly: d.plannedMonthly },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("มีหมวดชื่อนี้แล้ว");
    }
    throw e;
  }
  revalidatePath(`/plans/${d.planId}/budget`);
  return ok("บันทึกหมวดแล้ว");
}

export async function deleteCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const planId = String(formData.get("planId"));
  const categoryId = String(formData.get("categoryId"));
  await assertOwnsPlan(planId, userId);

  const txCount = await prisma.transaction.count({ where: { categoryId } });
  if (txCount > 0) {
    // Block delete when transactions exist — avoids orphaning history.
    return fail("หมวดนี้มีรายการอยู่ ลบรายการก่อน");
  }
  await prisma.category.deleteMany({ where: { id: categoryId, planId } });
  revalidatePath(`/plans/${planId}/budget`);
  return ok("ลบหมวดแล้ว");
}
