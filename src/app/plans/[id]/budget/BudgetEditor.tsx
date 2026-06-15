"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/app/actions/categories";
import {
  CATEGORY_TYPES,
  CATEGORY_TYPE_LABEL,
  type CategoryType,
} from "@/lib/categories";
import type { CalcCategory, BudgetRollup } from "@/lib/calc";
import { Card, Stat, Button, inputClass, ErrorText } from "@/components/ui";
import { useActionToast } from "@/components/useActionToast";
import { formatMoney } from "@/lib/format";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      บันทึก
    </Button>
  );
}

function CategoryRow({
  planId,
  cat,
}: {
  planId: string;
  cat: CalcCategory;
}) {
  const [state, action] = useActionState(updateCategoryAction, undefined);
  const [delState, delAction] = useActionState(deleteCategoryAction, undefined);
  useActionToast(state);
  useActionToast(delState);
  return (
    <div className="rounded-lg border border-ink/10 p-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="planId" value={planId} />
        <input type="hidden" name="categoryId" value={cat.id} />
        <div className="min-w-[140px] flex-1">
          <span className="mb-1 block text-xs text-muted">ชื่อหมวด</span>
          <input name="name" defaultValue={cat.name} required className={inputClass} />
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted">ประเภท</span>
          <select name="type" defaultValue={cat.type} className={inputClass}>
            {CATEGORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {CATEGORY_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <span className="mb-1 block text-xs text-muted">งบ/เดือน</span>
          <input
            name="plannedMonthly"
            type="number"
            min={0}
            step="any"
            defaultValue={cat.plannedMonthly}
            className={`${inputClass} tabular`}
          />
        </div>
        <SaveBtn />
      </form>
      <div className="mt-2 flex items-center justify-between">
        <ErrorText>
          {state?.status === "error" ? state.message : undefined}
        </ErrorText>
        <form
          action={delAction}
          onSubmit={(e) => {
            if (!confirm(`ลบหมวด "${cat.name}"?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="planId" value={planId} />
          <input type="hidden" name="categoryId" value={cat.id} />
          <Button type="submit" variant="danger">
            ลบ
          </Button>
        </form>
      </div>
    </div>
  );
}

function AddForm({ planId }: { planId: string }) {
  const [state, action] = useActionState(addCategoryAction, undefined);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="planId" value={planId} />
      <div className="min-w-[140px] flex-1">
        <span className="mb-1 block text-xs text-muted">ชื่อหมวดใหม่</span>
        <input name="name" required className={inputClass} placeholder="เช่น ค่าน้ำมัน" />
      </div>
      <div>
        <span className="mb-1 block text-xs text-muted">ประเภท</span>
        <select name="type" defaultValue={"VARIABLE" satisfies CategoryType} className={inputClass}>
          {CATEGORY_TYPES.map((t) => (
            <option key={t} value={t}>
              {CATEGORY_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-32">
        <span className="mb-1 block text-xs text-muted">งบ/เดือน</span>
        <input
          name="plannedMonthly"
          type="number"
          min={0}
          step="any"
          defaultValue={0}
          className={`${inputClass} tabular`}
        />
      </div>
      <Button type="submit" variant="gold">
        + เพิ่มหมวด
      </Button>
      {state?.status === "error" && (
        <div className="w-full">
          <ErrorText>{state.message}</ErrorText>
        </div>
      )}
    </form>
  );
}

export function BudgetEditor({
  planId,
  currency,
  categories,
  budget,
}: {
  planId: string;
  currency: string;
  categories: CalcCategory[];
  budget: BudgetRollup;
}) {
  const grouped = CATEGORY_TYPES.map((type) => ({
    type,
    items: categories.filter((c) => c.type === type),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-semibold text-ink">สรุปงบต่อเดือน</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="รายรับ" value={formatMoney(budget.income, currency)} accent="jade" />
          <Stat label="จ่ายคงที่" value={formatMoney(budget.fixed, currency)} accent="ink" />
          <Stat label="จ่ายผันแปร" value={formatMoney(budget.variable, currency)} accent="ink" />
          <Stat label="เป้าเก็บ" value={formatMoney(budget.saving, currency)} accent="gold" />
          <Stat
            label="buffer"
            value={formatMoney(budget.buffer, currency)}
            accent={budget.buffer < 0 ? "warn" : "jade"}
          />
        </div>
        {budget.buffer < 0 && (
          <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
            งบติดลบ — ลดรายจ่ายหรือเป้าเก็บ หรือเพิ่มรายรับ
          </p>
        )}
      </Card>

      {grouped.map((g) => (
        <Card key={g.type}>
          <h3 className="font-semibold text-ink">{CATEGORY_TYPE_LABEL[g.type]}</h3>
          <div className="mt-3 space-y-3">
            {g.items.length === 0 ? (
              <p className="text-sm text-muted">ยังไม่มีหมวดในกลุ่มนี้</p>
            ) : (
              g.items.map((cat) => (
                <CategoryRow key={cat.id} planId={planId} cat={cat} />
              ))
            )}
          </div>
        </Card>
      ))}

      <Card>
        <h3 className="font-semibold text-ink">เพิ่มหมวดใหม่</h3>
        <div className="mt-3">
          <AddForm planId={planId} />
        </div>
      </Card>
    </div>
  );
}
