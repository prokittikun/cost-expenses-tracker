"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  addTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from "@/app/actions/transactions";
import { suggestCategoryAction } from "@/app/actions/ai";
import { useToast } from "@/components/toast";
import {
  CATEGORY_TYPES,
  CATEGORY_TYPE_LABEL,
  type CategoryType,
} from "@/lib/categories";
import { Card, Button, Field, inputClass, ErrorText } from "@/components/ui";
import { useActionToast } from "@/components/useActionToast";
import { formatMoney, formatDate, toDateInputValue, formatMonthLabel } from "@/lib/format";

type Cat = { id: string; name: string; type: CategoryType };
type PlanRef = { id: string; name: string };
type Tx = {
  id: string;
  categoryId: string;
  categoryName: string;
  type: CategoryType;
  date: string;
  createdAt: string;
  amount: number;
  description: string;
  note: string;
  fromRule: boolean;
  isWithdrawal: boolean;
  synced: boolean;
};

const typeAccent: Record<CategoryType, string> = {
  INCOME: "text-jade",
  FIXED: "text-ink",
  VARIABLE: "text-ink",
  SAVING: "text-gold",
};

// Quick-pick presets so users don't have to think up a description/remark each time.
// Click fills the field; the value is still freely editable afterwards.
const DESCRIPTION_PRESETS = [
  "ค่าอาหาร",
  "ค่าเดินทาง",
  "ค่าช้อปปิ้ง",
  "ค่าน้ำค่าไฟ",
  "เก็บเงินประจำเดือน",
  "เงินเดือน",
];

const NOTE_PRESETS = [
  "ประจำเดือน",
  "จ่ายแทนเพื่อน",
  "ฉุกเฉิน",
  "วางแผนไว้แล้ว",
  "เกินงบ",
];

function QuickChips({
  options,
  onPick,
}: {
  options: string[];
  onPick: (value: string) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onPick(opt)}
          className="rounded-full border border-ink/15 bg-paper px-2.5 py-0.5 text-xs text-ink transition-colors hover:border-gold hover:bg-gold/10"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function AddBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending ? "กำลังบันทึก…" : "+ บันทึกรายการ"}
    </Button>
  );
}

function DeleteTxButton({
  planId,
  txId,
  synced = false,
}: {
  planId: string;
  txId: string;
  synced?: boolean;
}) {
  const [state, action] = useActionState(deleteTransactionAction, undefined);
  useActionToast(state);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const msg = synced
          ? "รายการนี้ซิงค์ข้ามเป้าหมาย — ลบแล้วจะลบทุกเป้าที่ซิงค์ไว้ ยืนยัน?"
          : "ลบรายการนี้?";
        if (!confirm(msg)) e.preventDefault();
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

type Grouped = { type: CategoryType; items: Cat[] }[];

// One ledger row that can flip into an inline edit form. Saving propagates to the
// whole sync group server-side (updateTransactionAction).
function TxRow({
  t,
  planId,
  currency,
  grouped,
}: {
  t: Tx;
  planId: string;
  currency: string;
  grouped: Grouped;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateTransactionAction, undefined);
  useActionToast(state);
  useEffect(() => {
    if (state?.status === "success") setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <tr className="border-b border-ink/5 bg-paper/50">
        <td colSpan={5} className="py-3">
          <form action={action} className="space-y-2">
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="txId" value={t.id} />
            {/* withdrawals keep their SAVING category — don't offer a category change */}
            {t.isWithdrawal && (
              <input type="hidden" name="categoryId" value={t.categoryId} />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                name="date"
                type="date"
                required
                defaultValue={t.date.slice(0, 10)}
                className={`${inputClass} w-auto tabular`}
              />
              {!t.isWithdrawal && (
                <select
                  name="categoryId"
                  required
                  defaultValue={t.categoryId}
                  className={`${inputClass} w-auto`}
                >
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
              )}
              <input
                name="amount"
                type="number"
                min={0.01}
                step="any"
                required
                defaultValue={t.amount}
                className={`${inputClass} w-28 tabular`}
              />
            </div>
            <input
              name="description"
              required
              maxLength={200}
              defaultValue={t.description}
              className={inputClass}
              placeholder="รายละเอียด"
            />
            <input
              name="note"
              maxLength={500}
              defaultValue={t.note}
              className={inputClass}
              placeholder="หมายเหตุ (ไม่บังคับ)"
            />
            {t.synced && (
              <p className="text-xs text-muted">
                รายการนี้ซิงค์ข้ามเป้าหมาย — แก้แล้วจะอัปเดตทุกเป้าที่ซิงค์ไว้
              </p>
            )}
            {state?.status === "error" && <ErrorText>{state.message}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit" variant="primary">
                บันทึก
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                ยกเลิก
              </Button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-ink/5">
      <td className="py-2 pr-3 tabular text-muted">{formatDate(t.date)}</td>
      <td className="py-2 pr-3">
        <span className={t.isWithdrawal ? "text-warn" : typeAccent[t.type]}>
          {t.categoryName}
        </span>
      </td>
      <td className="py-2 pr-3">
        {t.description}
        {t.isWithdrawal && (
          <span className="ml-2 rounded-full bg-warn/15 px-1.5 py-0.5 text-[10px] font-medium text-warn">
            เบิกออก
          </span>
        )}
        {t.fromRule && (
          <span className="ml-2 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-gold">
            ประจำ
          </span>
        )}
        {t.synced && (
          <span className="ml-2 rounded-full bg-jade/15 px-1.5 py-0.5 text-[10px] font-medium text-jade">
            ซิงค์
          </span>
        )}
        {t.note && <span className="block text-xs text-muted">{t.note}</span>}
      </td>
      <td
        className={`py-2 pr-3 text-right tabular ${
          t.isWithdrawal ? "text-warn" : typeAccent[t.type]
        }`}
      >
        {t.isWithdrawal ? "−" : ""}
        {formatMoney(t.amount, currency)}
      </td>
      <td className="py-2 text-right">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-ink hover:underline"
          >
            แก้
          </button>
          <DeleteTxButton planId={planId} txId={t.id} synced={t.synced} />
        </div>
      </td>
    </tr>
  );
}

export function LogClient({
  planId,
  currency,
  categories,
  transactions,
  aiEnabled = false,
  otherPlans = [],
}: {
  planId: string;
  currency: string;
  categories: Cat[];
  transactions: Tx[];
  aiEnabled?: boolean;
  otherPlans?: PlanRef[];
}) {
  const [state, action] = useActionState(addTransactionAction, undefined);
  useActionToast(state);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCat, setFilterCat] = useState("");

  // Controlled so quick-pick chips / AI suggestion can fill them; cleared after add.
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [suggesting, startSuggest] = useTransition();
  const toast = useToast();
  useEffect(() => {
    if (state?.status === "success") {
      setDescription("");
      setNote("");
      setCategoryId("");
    }
  }, [state]);

  // Auto-categorization (suggestion only — user can still change the select).
  function suggestCategory() {
    if (!description.trim()) {
      toast.error("ใส่รายละเอียดก่อนให้ AI แนะนำ");
      return;
    }
    startSuggest(async () => {
      const res = await suggestCategoryAction(planId, description);
      if (res.status === "ok") {
        setCategoryId(res.categoryId);
        toast.success(`AI แนะนำหมวด: ${res.categoryName}`);
      } else {
        toast.error(res.message);
      }
    });
  }

  // month options from existing transactions
  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const filtered = transactions
    .filter((t) => {
      if (filterMonth && t.date.slice(0, 7) !== filterMonth) return false;
      if (filterCat && t.categoryId !== filterCat) return false;
      return true;
    })
    // Newest first: by transaction date, then by entry time for same-day rows.
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

  const grouped = CATEGORY_TYPES.map((type) => ({
    type,
    items: categories.filter((c) => c.type === type),
  })).filter((g) => g.items.length > 0);

  // Sync is offered for income/expense only (savings allocation is per-goal).
  const selectedType = categories.find((c) => c.id === categoryId)?.type;
  const canSync =
    otherPlans.length > 0 && !!selectedType && selectedType !== "SAVING";

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
            <Field label="รายละเอียด">
              <input
                name="description"
                required
                maxLength={200}
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <QuickChips options={DESCRIPTION_PRESETS} onPick={setDescription} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="หมวดหมู่">
              <select
                name="categoryId"
                required
                className={inputClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
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
              {aiEnabled && (
                <button
                  type="button"
                  onClick={suggestCategory}
                  disabled={suggesting || !description.trim()}
                  className="mt-1.5 rounded-full border border-ink/15 bg-paper px-2.5 py-0.5 text-xs text-ink transition-colors hover:border-gold hover:bg-gold/10 disabled:opacity-50"
                >
                  {suggesting ? "กำลังแนะนำ…" : "✨ ให้ AI แนะนำหมวด"}
                </button>
              )}
            </Field>
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
          </div>
          <Field label="หมายเหตุ (ไม่บังคับ)">
            <input
              name="note"
              maxLength={500}
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <QuickChips options={NOTE_PRESETS} onPick={setNote} />
          </Field>

          {canSync && (
            <fieldset className="rounded-lg border border-ink/10 p-3">
              <legend className="px-1 text-xs font-medium text-ink">
                ใช้ร่วมกับเป้าหมายอื่น (กรอกครั้งเดียว ซิงค์ไปด้วย)
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {otherPlans.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      name="syncPlanIds"
                      value={p.id}
                      className="accent-gold"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                รายการที่ซิงค์จะผูกกัน — ลบที่เป้าไหนก็ลบพร้อมกันทุกเป้า
              </p>
            </fieldset>
          )}

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
                  <TxRow
                    key={t.id}
                    t={t}
                    planId={planId}
                    currency={currency}
                    grouped={grouped}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
