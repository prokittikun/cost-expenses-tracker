"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signupAction } from "@/app/actions/auth";
import { useActionToast } from "@/components/useActionToast";
import { Button, Field, inputClass, ErrorText } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" className="w-full" disabled={pending}>
      {pending ? "กำลังสมัคร…" : "สมัครสมาชิก"}
    </Button>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signupAction, undefined);
  useActionToast(state);
  return (
    <form action={action} className="space-y-4">
      <ErrorText>{state?.status === "error" ? state.message : undefined}</ErrorText>
      <Field label="ชื่อ (ไม่บังคับ)">
        <input
          name="name"
          type="text"
          autoComplete="name"
          className={inputClass}
          placeholder="ชื่อของคุณ"
        />
      </Field>
      <Field label="อีเมล">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          placeholder="you@example.com"
        />
      </Field>
      <Field label="รหัสผ่าน" hint="อย่างน้อย 8 ตัวอักษร">
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      <SubmitButton />
    </form>
  );
}
