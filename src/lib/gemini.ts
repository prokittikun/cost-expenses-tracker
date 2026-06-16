import "server-only";
import { GoogleGenAI } from "@google/genai";

// Server-only Gemini client. The API key never reaches the client — every call
// originates from a server action. Model is overridable via env so it can be
// bumped without code changes (default: cost-efficient flash).
//
// HARD RULE (enforced via prompts in callers): the model must NEVER compute or
// invent numbers. We compute every figure deterministically and pass it in; the
// model only parses text or writes prose around the numbers we give it.

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

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
