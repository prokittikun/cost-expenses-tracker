"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createPlanAction } from "@/app/actions/plans";
import { useActionToast } from "@/components/useActionToast";
import { CATEGORY_TEMPLATES } from "@/lib/categories";
import { Button, Field, inputClass, ErrorText, Card } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending ? "กำลังสร้าง…" : "สร้างเป้าหมาย"}
    </Button>
  );
}

export function NewPlanForm() {
  const [state, action] = useActionState(createPlanAction, undefined);
  useActionToast(state);
  return (
    <form action={action} className="space-y-5">
      <ErrorText>{state?.status === "error" ? state.message : undefined}</ErrorText>

      <Field label="ชื่อเป้าหมาย">
        <input
          name="name"
          required
          maxLength={120}
          className={inputClass}
          placeholder="เช่น ทริปญี่ปุ่น, ซื้อโน้ตบุ๊ก, เงินสำรองฉุกเฉิน"
        />
      </Field>

      <Field label="รายละเอียด (ไม่บังคับ)">
        <input name="description" maxLength={500} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ยอดที่ต้องเก็บ">
          <input
            name="targetAmount"
            type="number"
            min={1}
            step="any"
            required
            className={`${inputClass} tabular`}
            placeholder="65000"
          />
        </Field>
        <Field label="สกุลเงิน">
          <input
            name="currency"
            defaultValue="THB"
            maxLength={8}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="วันเริ่มเก็บ">
          <input
            name="startDate"
            type="date"
            required
            className={`${inputClass} tabular`}
          />
        </Field>
        <Field label="วันครบกำหนด">
          <input
            name="targetDate"
            type="date"
            required
            className={`${inputClass} tabular`}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">
          เทมเพลตหมวดหมู่
        </legend>
        <div className="space-y-2">
          {CATEGORY_TEMPLATES.map((t, i) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink/10 p-3 has-[:checked]:border-gold has-[:checked]:bg-gold/5"
            >
              <input
                type="radio"
                name="template"
                value={t.id}
                defaultChecked={i === 0}
                className="mt-1 accent-gold"
              />
              <span>
                <span className="block font-medium text-ink">{t.label}</span>
                <span className="block text-xs text-muted">{t.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Card className="bg-paper text-xs text-muted">
        จำนวนเดือนและยอดเก็บเฉลี่ยต่อเดือน คำนวณอัตโนมัติจากช่วงวันที่ —
        หมวดหมู่และงบปรับแก้ได้ทั้งหมดหลังสร้าง
      </Card>

      <SubmitButton />
    </form>
  );
}
