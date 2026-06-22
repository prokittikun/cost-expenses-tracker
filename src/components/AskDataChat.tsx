"use client";

import { useEffect, useRef, useState } from "react";
import { askDataAction, type ChatTurn } from "@/app/actions/ai-chat";
import { setAiOptInAction } from "@/app/actions/ai";
import { Button, inputClass } from "@/components/ui";

const EXAMPLES = [
  "เดือนนี้หมดกับกาแฟไปเท่าไหร่",
  "ถ้าเก็บแบบนี้จะครบทันไหม",
  "หมวดไหนใช้เกินงบ",
  "เป้าหมายไหนกำลังจะไม่ทัน",
];

type Msg = ChatTurn & { id: number };

// Floating "ask your data" chat. Conversation lives only in component state
// (never persisted). scopePlanId is set when opened from a plan page; null on
// the cross-plan overview.
export function AskDataChat({
  scopePlanId = null,
  optedIn: initialOptedIn,
}: {
  scopePlanId?: string | null;
  optedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, pending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setError(null);
    setInput("");
    const history: ChatTurn[] = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { id: nextId.current++, role: "user", text: q }]);
    setPending(true);
    try {
      const res = await askDataAction(history, q, scopePlanId);
      if (res.status === "ok") {
        setMessages((prev) => [
          ...prev,
          { id: nextId.current++, role: "model", text: res.answer },
        ]);
      } else if (res.status === "needs-optin") {
        setOptedIn(false);
      } else {
        setError(res.message);
      }
    } catch {
      setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  async function optIn() {
    await setAiOptInAction();
    setOptedIn(true);
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-ink/90"
        aria-expanded={open}
      >
        💬 ถามข้อมูลของฉัน{" "}
        <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold uppercase tracking-wider">
          Beta
        </span>
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[32rem] w-[min(92vw,26rem)] flex-col overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <div className="flex items-center gap-2 font-semibold text-ink">
              ถามข้อมูลของฉัน
              <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold uppercase tracking-wider">
                Beta
              </span>
              <span className="text-xs font-normal text-muted">
                {scopePlanId ? "· เป้าหมายนี้" : "· ทุกเป้าหมาย"} · Gemini
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted hover:text-ink"
              aria-label="ปิด"
            >
              ✕
            </button>
          </div>

          {!optedIn ? (
            <div className="flex flex-1 flex-col justify-center gap-3 p-5 text-sm">
              <p className="rounded-lg bg-paper px-3 py-3 text-muted">
                ฟีเจอร์นี้จะส่ง <span className="font-medium text-ink">ตัวเลขสรุปจากข้อมูลการเงินของคุณ</span>{" "}
                ไปยัง Google Gemini เพื่อช่วยตอบคำถาม (ส่งเฉพาะค่าที่จำเป็น
                ไม่ส่งรายการดิบทั้งหมด) กดยินยอมเพื่อเริ่มใช้งาน
              </p>
              <Button type="button" variant="gold" onClick={optIn}>
                ยินยอมและเริ่มถาม
              </Button>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted">
                      ถามเป็นภาษาไทยเกี่ยวกับเงินของคุณได้เลย เช่น:
                    </p>
                    <div className="flex flex-col gap-2">
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => send(ex)}
                          className="rounded-lg border border-ink/10 bg-paper px-3 py-2 text-left text-sm text-ink transition-colors hover:border-gold hover:bg-gold/10"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-ink text-white"
                          : "bg-paper text-ink"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}

                {pending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-paper px-3 py-2 text-sm text-muted">
                      กำลังคิด…
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
                    {error}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex gap-2 border-t border-ink/10 p-3"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="พิมพ์คำถาม…"
                  maxLength={500}
                  disabled={pending}
                  className={inputClass}
                />
                <Button type="submit" variant="gold" disabled={pending || !input.trim()}>
                  ส่ง
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
