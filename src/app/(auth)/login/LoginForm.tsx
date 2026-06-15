"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions/auth";
import { useActionToast } from "@/components/useActionToast";
import { Button, Field, inputClass, ErrorText } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" className="w-full" disabled={pending}>
      {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
    </Button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  useActionToast(state);
  return (
    <form action={action} className="space-y-4">
      <ErrorText>{state?.status === "error" ? state.message : undefined}</ErrorText>
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
      <Field label="รหัสผ่าน">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>
      <SubmitButton />
    </form>
  );
}
