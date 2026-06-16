"use client";

import { useState, useTransition } from "react";
import {
  setAiOptInAction,
  generateCoachSummaryAction,
} from "@/app/actions/ai";
import { Card, Button, ErrorText } from "@/components/ui";
import { useToast } from "@/components/toast";
import { formatMonthLabel } from "@/lib/format";

export function CoachSummary({
  planId,
  configured,
  optedIn: initialOptedIn,
  content: initialContent,
  generatedAt: initialGeneratedAt,
  month,
}: {
  planId: string;
  configured: boolean;
  optedIn: boolean;
  content: string | null;
  generatedAt: string | null;
  month: string;
}) {
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [content, setContent] = useState(initialContent);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  // Hide the feature entirely when no API key is configured server-side.
  if (!configured) return null;

  function optInThenGenerate() {
    setError(null);
    start(async () => {
      await setAiOptInAction();
      setOptedIn(true);
      const res = await generateCoachSummaryAction(planId);
      if (res.status === "ok") {
        setContent(res.content);
        setGeneratedAt(res.generatedAt);
        toast.success("สร้างสรุปแล้ว");
      } else {
        setError(res.message);
      }
    });
  }

  function generate() {
    setError(null);
    start(async () => {
      const res = await generateCoachSummaryAction(planId);
      if (res.status === "ok") {
        setContent(res.content);
        setGeneratedAt(res.generatedAt);
        toast.success("สร้างสรุปใหม่แล้ว");
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">
          สรุปจากโค้ช AI{" "}
          <span className="text-xs font-normal text-muted">
            เดือน {formatMonthLabel(month)} · Gemini
          </span>
        </h2>
        {optedIn && content && (
          <Button
            type="button"
            variant="outline"
            onClick={generate}
            disabled={pending}
          >
            {pending ? "กำลังสร้าง…" : "สร้างสรุปใหม่"}
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {!optedIn ? (
        // Opt-in notice — required before any figures are sent to Gemini.
        <div className="mt-3 space-y-3">
          <p className="rounded-lg bg-paper px-3 py-3 text-sm text-muted">
            ฟีเจอร์นี้จะส่ง <span className="font-medium text-ink">ตัวเลขสรุปการเงินของเดือนนี้</span>{" "}
            (เช่น รายรับ-รายจ่ายรวม หมวดที่ใช้มาก ความคืบหน้าการเก็บเงิน)
            ไปยัง Google Gemini API เพื่อสร้างคำแนะนำ — ไม่ส่งรายการแบบรายตัวหรือข้อมูลส่วนตัวอื่น
            กดยินยอมเพื่อเริ่มใช้งาน
          </p>
          <Button
            type="button"
            variant="gold"
            onClick={optInThenGenerate}
            disabled={pending}
          >
            {pending ? "กำลังสร้าง…" : "ยินยอมและสร้างสรุป"}
          </Button>
        </div>
      ) : content ? (
        <div className="mt-3">
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
            {content}
          </p>
          {generatedAt && (
            <p className="mt-2 text-xs text-muted">
              สร้างเมื่อ{" "}
              {new Intl.DateTimeFormat("th-TH", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(generatedAt))}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted">
            ยังไม่มีสรุปของเดือนนี้ — กดเพื่อให้ AI สรุปและแนะนำ
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="gold"
              onClick={generate}
              disabled={pending}
            >
              {pending ? "กำลังสร้าง…" : "สร้างสรุปเดือนนี้"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
