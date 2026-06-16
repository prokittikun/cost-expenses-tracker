"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { fail, type ActionResult } from "@/lib/action-state";

const signupSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร"),
});

export async function signupAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    name: (formData.get("name") as string) || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("อีเมลนี้ถูกใช้แล้ว");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { email, name: name ?? null, passwordHash } });

  await signIn("credentials", {
    email,
    password,
    redirectTo: "/overview",
  });
  return undefined;
}

export async function loginAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = formData.get("email");
  const password = formData.get("password");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/overview",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return fail("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    throw err; // redirect throws — must propagate
  }
  return undefined;
}
