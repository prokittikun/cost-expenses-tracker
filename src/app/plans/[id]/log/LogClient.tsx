"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  addTransactionAction,
  deleteTransactionAction,
} from "@/app/actions/transactions";
import {
  CATEGORY_TYPES,
  CATEGORY_TYPE_LABEL,
  type CategoryType,
} from "@/lib/categories";
import { Card, Button, Field, inputClass, ErrorText } from "@/components/ui";
import { useActionToast } from "@/components/useActionToast";
import { formatMoney, formatDate, toDateInputValue, formatMonthLabel } from "@/lib/format";

type Cat = { id: string; name: string; type: CategoryType };
type Tx = {
  id: string;
  categoryId: string;
  categoryName: string;
  type: CategoryType;
  date: string;
  amount: number;
  description: string;
  note: string;
};

const typeAccent: Record<CategoryType, string> = {
  INCOME: "text-jade",
  FIXED: "text-ink",
  VARIABLE: "text-ink",
  SAVING: "text-gold",
};

function AddBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending ? "กำลังบันทึก…" : "+ บันทึกรายการ"}
    </Button>
  );
}

function DeleteTxButton({ planId, txId }: { planId: string; txId: string }) {
  const [state, action] = useActionState(deleteTransactionAction, undefined);
  useActionToast(state);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("ลบรายการนี้?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="txId" value={txId} />
      <button type="submit" className="text-xs text-warn hover:underline">
        ลบ
      </button>
    </form>
  );
}

export function LogClient({
  planId,
  currency,
  categories,
  transactions,
}: {
  planId: string;
  currency: string;
  categories: Cat[];
  transactions: Tx[];
}) {
  const [state, action] = useActionState(addTransactionAction, undefined);
  useActionToast(state);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCat, setFilterCat] = useState("");

  // month options from existing transactions
  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const filtered = transactions.filter((t) => {
    if (filterMonth && t.date.slice(0, 7) !== filterMonth) return false;
    if (filterCat && t.categoryId !== filterCat) return false;
    return true;
  });

  const grouped = CATEGORY_TYPES.map((type) => ({
    type,
    items: categories.filter((c) => c.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-semibold text-ink">บันทึกรายการใหม่</h2>
        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="planId" value={planId} />
          <ErrorText>
            {state?.status === "error" ? state.message : undefined}
          </ErrorText>
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
            <Field label="หมวดหมู่">
              <select name="categoryId" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  เลือกหมวด…
                </option>
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
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="จำนวนเงิน">
              <input
                name="amount"
                type="number"
                min={0.01}
                step="any"
                required
                className={`${inputClass} tabular`}
                placeholder="0"
              />
            </Field>
            <Field label="รายละเอียด">
              <input name="description" required maxLength={200} className={inputClass} />
            </Field>
          </div>
          <Field label="หมายเหตุ (ไม่บังคับ)">
            <input name="note" maxLength={500} className={inputClass} />
          </Field>
          <AddBtn />
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">
            รายการทั้งหมด ({filtered.length})
          </h2>
          <div className="flex gap-2">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className={`${inputClass} w-auto`}
            >
              <option value="">ทุกเดือน</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className={`${inputClass} w-auto`}
            >
              <option value="">ทุกหมวด</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-4 text-sm text-muted">ยังไม่มีรายการ</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">วันที่</th>
                  <th className="py-2 pr-3 font-medium">หมวด</th>
                  <th className="py-2 pr-3 font-medium">รายละเอียด</th>
                  <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-ink/5">
                    <td className="py-2 pr-3 tabular text-muted">
                      {formatDate(t.date)}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={typeAccent[t.type]}>{t.categoryName}</span>
                    </td>
                    <td className="py-2 pr-3">
                      {t.description}
                      {t.note && (
                        <span className="block text-xs text-muted">{t.note}</span>
                      )}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular ${typeAccent[t.type]}`}>
                      {formatMoney(t.amount, currency)}
                    </td>
                    <td className="py-2 text-right">
                      <DeleteTxButton planId={planId} txId={t.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
