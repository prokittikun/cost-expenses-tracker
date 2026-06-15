// CategoryType — stored as String in DB (SQLite no enum), validated here.

export const CATEGORY_TYPES = ["INCOME", "FIXED", "VARIABLE", "SAVING"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export function isCategoryType(v: string): v is CategoryType {
  return (CATEGORY_TYPES as readonly string[]).includes(v);
}

export const CATEGORY_TYPE_LABEL: Record<CategoryType, string> = {
  INCOME: "รายรับ",
  FIXED: "รายจ่ายคงที่",
  VARIABLE: "รายจ่ายผันแปร",
  SAVING: "เก็บเข้าเป้าหมาย",
};

export type TemplateCategory = {
  name: string;
  type: CategoryType;
  plannedMonthly: number;
};

export type CategoryTemplate = {
  id: string;
  label: string;
  description: string;
  categories: TemplateCategory[];
};

// Templates live in code (per CLAUDE.md §6), copied into a Plan on creation.
export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    id: "general",
    label: "เก็บเงินเที่ยว / เป้าหมายทั่วไป",
    description: "ชุดหมวดหมู่เริ่มต้นครบ รายรับ–รายจ่าย–เงินเก็บ แก้ได้ทีหลัง",
    categories: [
      { name: "เงินเดือน", type: "INCOME", plannedMonthly: 0 },
      { name: "รายได้อื่น", type: "INCOME", plannedMonthly: 0 },
      { name: "ค่าห้อง", type: "FIXED", plannedMonthly: 0 },
      { name: "ค่าเน็ต", type: "FIXED", plannedMonthly: 0 },
      { name: "ค่าเดินทาง", type: "FIXED", plannedMonthly: 0 },
      { name: "ค่าอาหาร", type: "VARIABLE", plannedMonthly: 0 },
      { name: "บันเทิง/สังสรรค์", type: "VARIABLE", plannedMonthly: 0 },
      { name: "เบ็ดเตล็ด", type: "VARIABLE", plannedMonthly: 0 },
      { name: "เก็บเข้าเป้าหมาย", type: "SAVING", plannedMonthly: 0 },
    ],
  },
  {
    id: "scratch",
    label: "เริ่มจากศูนย์",
    description: "สร้างแค่หมวดเงินเก็บหมวดเดียว ที่เหลือเพิ่มเอง",
    categories: [{ name: "เก็บเข้าเป้าหมาย", type: "SAVING", plannedMonthly: 0 }],
  },
];

export function getTemplate(id: string): CategoryTemplate | undefined {
  return CATEGORY_TEMPLATES.find((t) => t.id === id);
}
