import { Type, type FunctionDeclaration } from "@google/genai";

// Gemini functionDeclarations for the read-only "Ask your data" tools. Schema
// only (no DB) — implementations live in ai-tools.ts and enforce ownership.
// Every tool is read-only; planId/month/keyword are hints the server re-validates.

export const AI_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "listPlans",
    description:
      "รายการเป้าหมายการเก็บเงินทั้งหมดของผู้ใช้ พร้อมยอดเป้า ยอดที่เก็บได้ %คืบหน้า วันครบกำหนด และสถานะตามแผน/ช้ากว่ากำหนด ใช้เมื่อต้องการดูภาพรวมหรือหา planId ของเป้าหมาย",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "getPlanProgress",
    description:
      "ความคืบหน้าของเป้าหมายหนึ่ง: เก็บได้แล้ว ยังเหลือ %คืบหน้า ต้องเก็บเฉลี่ยต่อเดือน วันคาดการณ์ถึงเป้าเทียบวันครบกำหนด",
    parameters: {
      type: Type.OBJECT,
      properties: { planId: { type: Type.STRING, description: "id ของเป้าหมาย" } },
      required: ["planId"],
    },
  },
  {
    name: "getMonthlySummary",
    description:
      "สรุปของเป้าหมายหนึ่งในเดือนที่ระบุ: รายรับ รายจ่าย เงินเก็บ คงเหลือ และยอดแยกตามหมวด",
    parameters: {
      type: Type.OBJECT,
      properties: {
        planId: { type: Type.STRING },
        month: { type: Type.STRING, description: 'เดือนรูปแบบ "YYYY-MM" เช่น "2026-06"' },
      },
      required: ["planId", "month"],
    },
  },
  {
    name: "getTopCategories",
    description:
      "หมวดที่ใช้จ่ายมากที่สุด พร้อมยอดและ%สัดส่วน ระบุ planId เพื่อดูเฉพาะเป้าหมายนั้น ไม่ระบุ=รวมทุกเป้าหมาย ระบุ month เพื่อดูเฉพาะเดือนนั้น",
    parameters: {
      type: Type.OBJECT,
      properties: {
        planId: { type: Type.STRING, description: "ไม่บังคับ; ไม่ใส่=ทุกเป้าหมาย" },
        month: { type: Type.STRING, description: 'ไม่บังคับ "YYYY-MM"' },
        n: { type: Type.NUMBER, description: "จำนวนหมวดสูงสุด (ค่าเริ่มต้น 5)" },
      },
    },
  },
  {
    name: "searchTransactionsTotal",
    description:
      'ยอดรวมและจำนวนรายการที่รายละเอียดมีคำค้น เช่น "กาแฟ" คืนผลรวมเท่านั้น ไม่คืนรายการดิบ ระบุ planId/month เพื่อจำกัดขอบเขตได้',
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword: { type: Type.STRING, description: "คำค้นในรายละเอียดรายการ" },
        planId: { type: Type.STRING, description: "ไม่บังคับ" },
        month: { type: Type.STRING, description: 'ไม่บังคับ "YYYY-MM"' },
      },
      required: ["keyword"],
    },
  },
  {
    name: "getSpendingTrend",
    description:
      "รายจ่ายรวมต่อเดือน (เทรนด์) ระบุช่วง fromMonth–toMonth ได้ ระบุ planId เพื่อเฉพาะเป้าหมายนั้น ไม่ระบุ=รวมทุกเป้าหมาย",
    parameters: {
      type: Type.OBJECT,
      properties: {
        planId: { type: Type.STRING, description: "ไม่บังคับ" },
        fromMonth: { type: Type.STRING, description: 'ไม่บังคับ "YYYY-MM"' },
        toMonth: { type: Type.STRING, description: 'ไม่บังคับ "YYYY-MM"' },
      },
    },
  },
  {
    name: "getSafeToSpend",
    description:
      "ยอดที่ใช้จ่ายผันแปรได้อีกในเดือนนี้ของเป้าหมายหนึ่ง (รายรับตามแผน − จ่ายคงที่ − เป้าเก็บ − จ่ายผันแปรที่ใช้ไปแล้ว) พร้อมยอดต่อวันและวันที่เหลือ",
    parameters: {
      type: Type.OBJECT,
      properties: {
        planId: { type: Type.STRING },
        month: { type: Type.STRING, description: 'ไม่บังคับ "YYYY-MM" (ค่าเริ่มต้น=เดือนนี้)' },
      },
      required: ["planId"],
    },
  },
];

export const AI_TOOL_NAMES = AI_TOOL_DECLARATIONS.map((d) => d.name!);
