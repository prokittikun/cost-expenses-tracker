"use client";

import { useEffect, useState, useTransition } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { parseTransactionAction, type ParsedTransaction } from "@/app/actions/ai";
import { addTransactionAction } from "@/app/actions/transactions";
import {
  CATEGORY_TYPES,
  CATEGORY_TYPE_LABEL,
  type CategoryType,
} from "@/lib/categories";
import { Card, Button, inputClass, ErrorText } from "@/components/ui";
import { useActionToast } from "@/components/useActionToast";

type Cat = { id: string; name: string; type: CategoryType };

function ConfirmBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" disabled={pending}>
      {pending ? "กำลังบันทึก…" : "ยืนยันบันทึก"}
    </Button>
  );
}

export function AiQuickEntry({
  planId,
  categories,
}: {
  planId: string;
  categories: Cat[];
}) {
  const [text, setText] = useState("");
  const [parsing, startParse] = useTransition();
  const [parseError, setParseError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ParsedTransaction | null>(null);

  // Confirm uses the existing, fully-validated add-transaction action.
  const [saveState, saveAction] = useActionState(addTransactionAction, undefined);
  useActionToast(saveState);

  // Clear the draft + box after a successful save.
  useEffect(() => {
    if (saveState?.status === "success") {
      setDraft(null);
      setText("");
    }
  }, [saveState]);

  function runParse() {
    setParseError(null);
    startParse(async () => {
      const res = await parseTransactionAction(planId, text);
      if (res.status === "ok") setDraft(res.parsed);
      else setParseError(res.message);
    });
  }

  const grouped = CATEGORY_TYPES.map((type) => ({
    type,
    items: categories.filter((c) => c.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <Card>
      <h2 className="font-semibold text-ink">
        บันทึกด้วยข้อความ (AI){" "}
        <span className="text-xs font-normal text-muted">ขับเคลื่อนด้วย Gemini</span>
      </h2>
      <p className="mt-1 text-xs text-muted">
        พิมพ์แบบธรรมชาติ เช่น “ข้าวเที่ยง 120 เมื่อวาน” หรือ “จ่ายค่าเน็ต 600” แล้ว AI
        จะแยกข้อมูลให้ตรวจก่อนบันทึก
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim() && !parsing) {
              e.preventDefault();
              runParse();
            }
          }}
          maxLength={300}
          placeholder="พิมพ์รายการ…"
          className={inputClass}
        />
        <Button
          type="button"
          variant="primary"
          onClick={runParse}
          disabled={parsing || !text.trim()}
        >
          {parsing ? "กำลังแยก…" : "แยกข้อมูล"}
        </Button>
      </div>

      {parseError && (
        <div className="mt-3">
          <ErrorText>{parseError}</ErrorText>
        </div>
      )}

      {/* Editable prefilled form — user confirms before saving. Never auto-saved. */}
      {draft && (
        <form action={saveAction} className="mt-4 space-y-3 rounded-lg border border-gold/30 bg-gold/5 p-3">
          <div className="text-xs font-medium text-ink">
            ตรวจสอบแล้วแก้ได้ก่อนบันทึก
          </div>
          <input type="hidden" name="planId" value={planId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">วันที่</span>
              <input
                name="date"
                type="date"
                required
                defaultValue={draft.date}
                className={`${inputClass} tabular`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">หมวดหมู่</span>
              <select
                name="categoryId"
                required
                defaultValue={draft.categoryId}
                className={inputClass}
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
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">จำนวนเงิน</span>
              <input
                name="amount"
                type="number"
                min={0.01}
                step="any"
                required
                defaultValue={draft.amount}
                className={`${inputClass} tabular`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">รายละเอียด</span>
              <input
                name="description"
                required
                maxLength={200}
                defaultValue={draft.description}
                className={inputClass}
              />
            </label>
          </div>
          <input type="hidden" name="note" value="" />
          {saveState?.status === "error" && (
            <ErrorText>{saveState.message}</ErrorText>
          )}
          <div className="flex gap-2">
            <ConfirmBtn />
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(null)}
            >
              ยกเลิก
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
