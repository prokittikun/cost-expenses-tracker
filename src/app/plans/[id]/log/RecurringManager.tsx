"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createRuleAction,
  updateRuleAction,
  toggleRuleActiveAction,
  deleteRuleAction,
  generateNowAction,
} from "@/app/actions/recurring";
import {
  CATEGORY_TYPES,
  CATEGORY_TYPE_LABEL,
  type CategoryType,
} from "@/lib/categories";
import { Card, Button, inputClass, ErrorText } from "@/components/ui";
import { useActionToast } from "@/components/useActionToast";
import { formatMoney } from "@/lib/format";

type Cat = { id: string; name: string; type: CategoryType };
type Rule = {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  description: string;
  dayOfMonth: number;
  startDate: string;
  endDate: string;
  active: boolean;
  generatedCount: number;
};

function PendingButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "gold" | "outline" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {children}
    </Button>
  );
}

function CategorySelect({
  categories,
  defaultValue,
}: {
  categories: Cat[];
  defaultValue?: string;
}) {
  const grouped = CATEGORY_TYPES.map((type) => ({
    type,
    items: categories.filter((c) => c.type === type),
  })).filter((g) => g.items.length > 0);
  return (
    <select
      name="categoryId"
      required
      defaultValue={defaultValue ?? ""}
      className={inputClass}
    >
      {!defaultValue && (
        <option value="" disabled>
          เลือกหมวด…
        </option>
      )}
      {grouped.map((g) => (
        <optgroup key={g.type} label={CATEGORY_TYPE_LABEL[g.type]}>
          {g.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function RuleFields({
  categories,
  rule,
}: {
  categories: Cat[];
  rule?: Rule;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">หมวดหมู่</span>
          <CategorySelect categories={categories} defaultValue={rule?.categoryId} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">รายละเอียด</span>
          <input
            name="description"
            required
            maxLength={200}
            defaultValue={rule?.description}
            className={inputClass}
            placeholder="เช่น ค่าเช่าห้อง"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">จำนวนเงิน</span>
          <input
            name="amount"
            type="number"
            min={0.01}
            step="any"
            required
            defaultValue={rule?.amount}
            className={`${inputClass} tabular`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">วันที่ของเดือน (1–31)</span>
          <input
            name="dayOfMonth"
            type="number"
            min={1}
            max={31}
            required
            defaultValue={rule?.dayOfMonth ?? 1}
            className={`${inputClass} tabular`}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">เริ่ม</span>
            <input
              name="startDate"
              type="date"
              required
              defaultValue={rule?.startDate}
              className={`${inputClass} tabular`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">สิ้นสุด (ถ้ามี)</span>
            <input
              name="endDate"
              type="date"
              defaultValue={rule?.endDate}
              className={`${inputClass} tabular`}
            />
          </label>
        </div>
      </div>
    </>
  );
}

function CreateRuleForm({
  planId,
  categories,
}: {
  planId: string;
  categories: Cat[];
}) {
  const [state, action] = useActionState(createRuleAction, undefined);
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="planId" value={planId} />
      {state?.status === "error" && <ErrorText>{state.message}</ErrorText>}
      <RuleFields categories={categories} />
      <PendingButton variant="gold">+ เพิ่มรายการประจำ</PendingButton>
    </form>
  );
}

function EditRuleForm({
  planId,
  categories,
  rule,
  onClose,
}: {
  planId: string;
  categories: Cat[];
  rule: Rule;
  onClose: () => void;
}) {
  const [state, action] = useActionState(updateRuleAction, undefined);
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="ruleId" value={rule.id} />
      {state?.status === "error" && <ErrorText>{state.message}</ErrorText>}
      <RuleFields categories={categories} rule={rule} />
      <div className="flex gap-2">
        <PendingButton variant="primary">บันทึก</PendingButton>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

function RuleItem({
  planId,
  categories,
  rule,
}: {
  planId: string;
  categories: Cat[];
  rule: Rule;
}) {
  const [editing, setEditing] = useState(false);
  const [toggleState, toggleAction] = useActionState(
    toggleRuleActiveAction,
    undefined,
  );
  const [delState, delAction] = useActionState(deleteRuleAction, undefined);
  useActionToast(toggleState);
  useActionToast(delState);

  return (
    <div className="rounded-lg border border-ink/10 p-3">
      {editing ? (
        <EditRuleForm
          planId={planId}
          categories={categories}
          rule={rule}
          onClose={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink">{rule.description}</span>
              {!rule.active && (
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-muted">
                  หยุดชั่วคราว
                </span>
              )}
            </div>
            <div className="text-xs text-muted tabular">
              {rule.categoryName} · ทุกวันที่ {rule.dayOfMonth} ·{" "}
              {formatMoney(rule.amount)} · สร้างแล้ว {rule.generatedCount} รายการ
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(true)}
            >
              แก้ไข
            </Button>
            <form action={toggleAction}>
              <input type="hidden" name="planId" value={planId} />
              <input type="hidden" name="ruleId" value={rule.id} />
              <Button type="submit" variant="outline">
                {rule.active ? "หยุด" : "เปิด"}
              </Button>
            </form>
            <form
              action={delAction}
              onSubmit={(e) => {
                if (!confirm(`ลบรายการประจำ "${rule.description}"? (รายการที่สร้างแล้วจะยังอยู่)`))
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="planId" value={planId} />
              <input type="hidden" name="ruleId" value={rule.id} />
              <Button type="submit" variant="danger">
                ลบ
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GenerateNowButton({ planId }: { planId: string }) {
  const [state, action] = useActionState(generateNowAction, undefined);
  useActionToast(state);
  return (
    <form action={action}>
      <input type="hidden" name="planId" value={planId} />
      <PendingButton variant="outline">สร้างรายการประจำของเดือนนี้</PendingButton>
    </form>
  );
}

export function RecurringManager({
  planId,
  categories,
  rules,
}: {
  planId: string;
  currency: string;
  categories: Cat[];
  rules: Rule[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left font-semibold text-ink"
      >
        <span>
          รายการประจำ (recurring){" "}
          <span className="text-sm font-normal text-muted">
            {rules.length} กฎ
          </span>
        </span>
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          <p className="text-xs text-muted">
            รายการประจำจะถูกสร้างอัตโนมัติเมื่อเปิดหน้านี้หรือแดชบอร์ด
            (กันซ้ำต่อเดือน ไม่สร้างเกินวันสิ้นสุด) — รายการที่สร้างแล้วแก้/ลบได้ทีละรายการ
          </p>

          <div className="flex justify-end">
            <GenerateNowButton planId={planId} />
          </div>

          {rules.length > 0 && (
            <div className="space-y-2">
              {rules.map((r) => (
                <RuleItem
                  key={r.id}
                  planId={planId}
                  categories={categories}
                  rule={r}
                />
              ))}
            </div>
          )}

          <div className="border-t border-ink/10 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">เพิ่มรายการประจำใหม่</h3>
            <CreateRuleForm planId={planId} categories={categories} />
          </div>
        </div>
      )}
    </Card>
  );
}
