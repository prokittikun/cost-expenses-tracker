import "server-only";
import { GoogleGenAI } from "@google/genai";

// Server-only Gemini client. The API key never reaches the client — every call
// originates from a server action. Model is overridable via env so it can be
// bumped without code changes (default: cost-efficient flash).
//
// HARD RULE (enforced via prompts in callers): the model must NEVER compute or
// invent numbers. We compute every figure deterministically and pass it in; the
// model only parses text or writes prose around the numbers we give it.

// Light tasks (parse / suggest / coach): flash-lite is cheap and good enough.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

// Conversational chat uses function calling + multi-step Thai reasoning, which
// flash-lite handles poorly (picks wrong tool, returns empty answers). Use the
// stronger flash by default; override with GEMINI_CHAT_MODEL.
export const GEMINI_CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function getGemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

// Maps a thrown Gemini/SDK error to a friendly Thai message. 429 (quota / rate
// limit) is common on the free tier and deserves its own message so users aren't
// told a generic "failed" when they've simply hit the daily cap.
export function geminiErrorMessage(err: unknown): string {
  const status =
    (err as { status?: number })?.status ??
    (typeof (err as { message?: string })?.message === "string" &&
    (err as { message: string }).message.includes("429")
      ? 429
      : undefined);
  const text = String((err as { message?: string })?.message ?? "");

  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(text)) {
    return "ใช้ AI ครบโควต้าชั่วคราวแล้ว ลองใหม่อีกครั้งในอีกสักครู่ (หรือพรุ่งนี้)";
  }
  if (status === 401 || status === 403) {
    return "การตั้งค่า AI ไม่ถูกต้อง (API key)";
  }
  return "เรียก AI ไม่สำเร็จ ลองใหม่อีกครั้ง";
}
