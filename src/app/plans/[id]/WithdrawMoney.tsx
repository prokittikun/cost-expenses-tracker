"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { withdrawFromGoalAction } from "@/app/actions/transactions";
import { Card, Button, Field, inputClass, ErrorText } from "@/components/ui";
import { useActionToast } from "@/components/useActionToast";
import { formatMoney, toDateInputValue } from "@/lib/format";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "กำลังบันทึก…" : "ยืนยันเบิกเงิน"}
    </Button>
  );
}

// Withdraw money out of the goal's savings pot (e.g. spent the saved money on the
// goal). Reduces the net balance; the dashboard figures update accordingly.
export function WithdrawMoney({
  planId,
  currency,
  available,
}: {
  planId: string;
  currency: string;
  available: number; // current net pot balance, for the over-withdraw warning
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [state, action] = useActionState(withdrawFromGoalAction, undefined);
  useActionToast(state);

  const over = Number(amount) > available;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left font-semibold text-ink"
      >
        เบิกเงินออกจากเป้าหมาย
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="planId" value={planId} />
          <p className="text-xs text-muted">
            ใช้เมื่อนำเงินที่เก็บไว้ออกไปใช้ (เช่น จองตั๋ว มัดจำ) — ยอด “เก็บได้แล้ว”
            จะลดลงตามจริง คงเหลือในเป้าตอนนี้ {formatMoney(available, currency)}
          </p>
          {state?.status === "error" && <ErrorText>{state.message}</ErrorText>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="วันที่">
              <input
                name="date"
                type="date"
                required
                defaultValue={toDateInputValue(new Date())}
                className={`${inputClass} tabular`}
              />
            </Field>
            <Field label="จำนวนเงินที่เบิก">
              <input
                name="amount"
                type="number"
                min={0.01}
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputClass} tabular`}
                placeholder="0"
              />
            </Field>
          </div>
          <Field label="เหตุผล">
            <input
              name="description"
              required
              maxLength={200}
              className={inputClass}
              placeholder="เช่น จองตั๋วเครื่องบิน"
            />
          </Field>
          <Field label="หมายเหตุ (ไม่บังคับ)">
            <input name="note" maxLength={500} className={inputClass} />
          </Field>
          {over && (
            <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
              เบิกมากกว่ายอดคงเหลือ ({formatMoney(available, currency)}) —
              บันทึกได้ แต่ยอดเก็บจะติดลบ
            </p>
          )}
          <SubmitBtn />
        </form>
      )}
    </Card>
  );
}
