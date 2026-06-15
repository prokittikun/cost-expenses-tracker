"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updatePlanAction,
  toggleArchiveAction,
  deletePlanAction,
} from "@/app/actions/plans";
import { Card, Button, Field, inputClass, ErrorText } from "@/components/ui";
import { useActionToast } from "@/components/useActionToast";
import { toDateInputValue } from "@/lib/format";

type PlanData = {
  id: string;
  name: string;
  description: string;
  currency: string;
  targetAmount: number;
  startDate: string;
  targetDate: string;
  archived: boolean;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}
    </Button>
  );
}

export function PlanSettings({ plan }: { plan: PlanData }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updatePlanAction, undefined);
  const [archiveState, archiveAction] = useActionState(
    toggleArchiveAction,
    undefined,
  );
  useActionToast(state);
  useActionToast(archiveState);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left font-semibold text-ink"
      >
        ตั้งค่าเป้าหมาย
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-6">
          <form action={action} className="space-y-4">
            <input type="hidden" name="planId" value={plan.id} />
            <ErrorText>
              {state?.status === "error" ? state.message : undefined}
            </ErrorText>

            <Field label="ชื่อเป้าหมาย">
              <input
                name="name"
                defaultValue={plan.name}
                required
                className={inputClass}
              />
            </Field>
            <Field label="รายละเอียด">
              <input
                name="description"
                defaultValue={plan.description}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="ยอดที่ต้องเก็บ">
                <input
                  name="targetAmount"
                  type="number"
                  min={1}
                  step="any"
                  defaultValue={plan.targetAmount}
                  required
                  className={`${inputClass} tabular`}
                />
              </Field>
              <Field label="สกุลเงิน">
                <input
                  name="currency"
                  defaultValue={plan.currency}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="วันเริ่มเก็บ">
                <input
                  name="startDate"
                  type="date"
                  defaultValue={toDateInputValue(plan.startDate)}
                  required
                  className={`${inputClass} tabular`}
                />
              </Field>
              <Field label="วันครบกำหนด">
                <input
                  name="targetDate"
                  type="date"
                  defaultValue={toDateInputValue(plan.targetDate)}
                  required
                  className={`${inputClass} tabular`}
                />
              </Field>
            </div>
            <SaveButton />
          </form>

          <div className="flex flex-wrap gap-3 border-t border-ink/10 pt-4">
            <form action={archiveAction}>
              <input type="hidden" name="planId" value={plan.id} />
              <Button type="submit" variant="outline">
                {plan.archived ? "เลิกเก็บถาวร" : "เก็บถาวร"}
              </Button>
            </form>

            <form
              action={deletePlanAction}
              onSubmit={(e) => {
                if (
                  !confirm(
                    "ลบเป้าหมายนี้พร้อมหมวดหมู่และรายการทั้งหมด? ย้อนกลับไม่ได้",
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="planId" value={plan.id} />
              <Button type="submit" variant="danger">
                ลบเป้าหมาย
              </Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
