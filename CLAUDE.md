
# CLAUDE.md — Savings Planner (multi-user)

> ไฟล์นี้คือบริบทส่งต่อจากการวางแผนในแชท Claude.ai
> วางไว้ที่ root ของโปรเจกต์ แล้วเปิด Claude Code ในโฟลเดอร์นี้ — มันจะอ่านอัตโนมัติตอนเริ่ม
> เป้าหมาย: เว็บแอป Next.js + ฐานข้อมูล สำหรับ "วางแผนเก็บเงิน" แบบหลายผู้ใช้ ที่แต่ละคนสร้างเป้าหมายของตัวเองได้อิสระ

---

## 1. โปรเจกต์นี้คืออะไร

แพลตฟอร์มวางแผนและติดตามการเก็บเงิน (savings planner) ภาษาไทย แบบ **หลายผู้ใช้**
ใครก็สมัครเข้ามาได้ แล้วสร้าง "เป้าหมายการเก็บเงิน" (Plan) ของตัวเองได้ไม่จำกัด — จะเป็นทริปท่องเที่ยว, ซื้อของชิ้นใหญ่, เงินสำรองฉุกเฉิน, อะไรก็ได้ ระบบช่วยคำนวณว่าต้องเก็บเดือนละเท่าไหร่ และติดตามรายรับรายจ่ายจริงเทียบกับแผน

> ที่มา: เดิมเป็นแอปเก็บเงินทริปจีนของผู้ใช้คนเดียว (มีเวอร์ชัน Excel) ตอนนี้ generalize ให้ยืดหยุ่นและรองรับหลายคน ทริปจีนเหลือสถานะเป็นแค่ "เทมเพลตตัวอย่าง" ไม่ใช่โครงสร้างตายตัว

## 2. หลักการออกแบบ (สำคัญ — อย่า hardcode)

- **ไม่ fix เป้าหมายใดๆ ในโค้ด** ทุกอย่างที่เคยเป็นค่าคงที่ (เป้า 65000, วันที่ ธ.ค. 2026, หมวดหมู่) ต้องมาจากข้อมูลที่ผู้ใช้สร้าง
- **จำนวนเดือน/ช่วงเวลา คำนวณจากวันที่ของ Plan** ไม่ให้กรอก monthsRemaining มือ
- **ทุกข้อมูลผูกกับเจ้าของ** ผู้ใช้เห็นและแก้ได้เฉพาะของตัวเอง
- หมวดหมู่ งบ ยอดเป้า วันที่ ปรับได้หมดผ่าน UI ไม่ต้องแก้โค้ด

## 3. Tech stack ที่เสนอ

- **Next.js 15** (App Router) + **TypeScript** (strict)
- **Prisma** ORM
  - dev/รันในเครื่อง: **SQLite** (ไฟล์เดียว ตั้งง่าย)
  - ถ้า deploy ให้คนอื่นใช้จริง: แนะนำ **PostgreSQL** (เช่น Neon/Supabase) — เพราะ Prisma อยู่แล้ว สลับ datasource ได้ไม่ยาก
- **Auth.js (NextAuth v5)** + Prisma adapter สำหรับสมัคร/ล็อกอิน
- **Tailwind CSS** styling
- **Recharts** สำหรับกราฟเงินสะสม
- ใช้ Server Actions หรือ Route Handlers สำหรับ CRUD

> ก่อนเปลี่ยน stack หลักหรือเพิ่ม dependency ใหญ่ ให้ถามเจ้าของก่อน

## 4. ระบบสมาชิก & ความปลอดภัย

- สมัครด้วย email + password; รองรับเพิ่ม OAuth (Google) ภายหลังได้
- **เก็บรหัสผ่านแบบ hash เท่านั้น** (bcrypt หรือ argon2) ห้ามเก็บ plaintext
- ใช้ session/JWT ของ Auth.js; middleware ป้องกันทุกหน้าใต้ `/app` (ต้องล็อกอิน)
- **Authorization**: ทุก query/mutation ต้องตรวจว่า resource เป็นของ session user เสมอ ห้ามเชื่อ userId/planId ที่ส่งมาจาก client โดยไม่ตรวจสิทธิ์
- หน้า public: landing, /login, /signup เท่านั้น

## 5. โครงสร้างข้อมูล (Prisma schema)

```prisma
enum CategoryType {
  INCOME    // รายรับ
  FIXED     // รายจ่ายคงที่
  VARIABLE  // รายจ่ายผันแปร
  SAVING    // เงินที่กันเก็บเข้าเป้าหมายนี้
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  passwordHash String
  plans        Plan[]
  createdAt    DateTime @default(now())
}

model Plan {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String                          // "ทริปจีน", "ซื้อโน้ตบุ๊ก", "เงินสำรองฉุกเฉิน"
  description  String        @default("")
  currency     String        @default("THB")
  targetAmount Float                           // ยอดที่ต้องเก็บให้ครบ
  startDate    DateTime                        // เริ่มเก็บเมื่อไหร่
  targetDate   DateTime                        // ต้องครบเมื่อไหร่ (ใช้คำนวณเดือนที่เหลือ)
  archived     Boolean       @default(false)
  categories   Category[]
  transactions Transaction[]
  createdAt    DateTime      @default(now())
}

model Category {
  id             String        @id @default(cuid())
  planId         String
  plan           Plan          @relation(fields: [planId], references: [id], onDelete: Cascade)
  name           String
  type           CategoryType
  plannedMonthly Float         @default(0)
  sortOrder      Int           @default(0)
  transactions   Transaction[]
  @@unique([planId, name])
}

model Transaction {
  id          String   @id @default(cuid())
  planId      String
  plan        Plan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])
  date        DateTime
  amount      Float                            // ค่าบวกเสมอ ตีความตาม category.type
  description String
  note        String   @default("")
  createdAt   DateTime @default(now())
}
```

แต่ละ Plan เป็นหน่วยอิสระ (มีหมวดหมู่และรายการของตัวเอง) เพื่อให้ยืดหยุ่นสุด

## 6. เทมเพลตหมวดหมู่ (ใช้ตอนสร้าง Plan ใหม่)

เก็บเป็น constant ในโค้ด ไม่ใช่ในฐานข้อมูล ตอนสร้าง Plan ให้ผู้ใช้เลือกเทมเพลต แล้ว copy หมวดหมู่เริ่มต้นเข้า Plan นั้น (แก้/ลบ/เพิ่มต่อได้)

**เทมเพลต "เก็บเงินเที่ยว / เป้าหมายทั่วไป"** (ค่าเริ่มต้น แก้ได้):

| name | type | plannedMonthly |
|---|---|---|
| เงินเดือน | INCOME | 0 |
| รายได้อื่น | INCOME | 0 |
| ค่าห้อง | FIXED | 0 |
| ค่าเน็ต | FIXED | 0 |
| ค่าเดินทาง | FIXED | 0 |
| ค่าอาหาร | VARIABLE | 0 |
| บันเทิง/สังสรรค์ | VARIABLE | 0 |
| เบ็ดเตล็ด | VARIABLE | 0 |
| เก็บเข้าเป้าหมาย | SAVING | 0 |

**เทมเพลต "เริ่มจากศูนย์"**: สร้างแค่หมวด SAVING "เก็บเข้าเป้าหมาย" หมวดเดียว ที่เหลือผู้ใช้เพิ่มเอง

> seed: สร้างเฉพาะ demo user สำหรับ dev (เช่น demo@example.com) พร้อม 1 Plan ตัวอย่างคือ "ทริปจีน ธ.ค. 2026" target 65000, startDate 2026-06-01, targetDate 2026-11-30 เพื่อทดสอบ ไม่ต้อง seed ข้อมูลผูกกับผู้ใช้จริง

## 7. โครงสร้างหน้า (App Router)

- `/` — landing page อธิบายแอป + ปุ่มสมัคร/ล็อกอิน
- `/signup`, `/login` — ระบบสมาชิก
- `/plans` — รายการ Plan ทั้งหมดของผู้ใช้ (การ์ดแสดงชื่อ, % คืบหน้า, วันครบกำหนด) + ปุ่มสร้างใหม่
- `/plans/new` — ฟอร์มสร้าง Plan: ชื่อ, ยอดเป้า, วันเริ่ม, วันครบกำหนด, เลือกเทมเพลตหมวดหมู่
- `/plans/[id]` — แดชบอร์ดของ Plan นั้น
- `/plans/[id]/budget` — แก้หมวดหมู่และงบต่อเดือน
- `/plans/[id]/log` — บันทึกรายการ (เพิ่ม/ลบ transaction)
- `/plans/[id]/summary` — สรุปรายเดือน
- ตั้งค่า/แก้/archive/ลบ Plan ได้จากหน้าแดชบอร์ดของ Plan

## 8. ฟีเจอร์แต่ละหน้า

### แดชบอร์ดของ Plan (`/plans/[id]`)
- การ์ดฮีโร่: % คืบหน้าเทียบ targetAmount + แทร็คความคืบหน้าที่มีหมุดเดือนจาก startDate→targetDate และธงปลายทางที่ยอดเป้า
- เก็บได้แล้ว, ยังต้องเก็บอีก, **ต้องเก็บเฉลี่ย/เดือน** (คำนวณจากเดือนที่เหลือถึง targetDate)
- สรุปงบตามแผน: รวมรายรับ / จ่ายคงที่ / จ่ายผันแปร / เป้าเก็บ / buffer
- กราฟเงินสะสมไต่ขึ้นไปหายอดเป้า ตามเดือนในช่วงของ Plan

### แก้งบประมาณ (`/plans/[id]/budget`)
- แก้ plannedMonthly ของแต่ละหมวด, เพิ่ม/ลบ/เปลี่ยนชื่อหมวด, จัดลำดับ
- แสดง subtotal และ buffer = Σ INCOME − Σ FIXED − Σ VARIABLE − Σ(plannedMonthly ของ SAVING) ; ถ้าติดลบเตือนสีแดง

### บันทึกรายการ (`/plans/[id]/log`)
- ฟอร์ม: วันที่, หมวดหมู่ (เลือกจากหมวดของ Plan นี้ group ตาม type), จำนวนเงิน, รายละเอียด, หมายเหตุ
- type ดึงอัตโนมัติจากหมวดที่เลือก
- ตารางรายการ เรียงใหม่สุดบน ลบได้ (ยืนยันก่อนลบ), กรองตามเดือน/หมวดได้

### สรุปรายเดือน (`/plans/[id]/summary`)
- คอลัมน์ = ทุกเดือนตั้งแต่ startDate ถึง targetDate (คำนวณ dynamic)
- แถว: รายรับรวม, รายจ่ายแต่ละหมวด, รวมรายจ่าย, เก็บเข้าเป้าหมาย, คงเหลือสิ้นเดือน, เงินสะสม (running total)

## 9. สูตรคำนวณ (ต่อ Plan, dynamic ตามวันที่)

- `savedSoFar` = Σ amount ของ transaction ที่ category.type = SAVING ใน Plan นั้น
- `remaining` = max(targetAmount − savedSoFar, 0)
- `progress` = savedSoFar / targetAmount (cap 100% เวลาแสดงแถบ)
- `monthsRemaining` = จำนวนเดือนจากวันนี้ถึง targetDate (ปัดขึ้น, อย่างน้อย 1)
- `avgNeededPerMonth` = remaining / monthsRemaining
- รายเดือน (bucket ตาม YYYY-MM ของ transaction.date ในช่วง startDate→targetDate):
  - income(m)=Σ type INCOME ; expense(m)=Σ type∈{FIXED,VARIABLE} ; saving(m)=Σ type SAVING
  - net(m)=income−expense−saving ; cumulativeSaving(m)=Σ saving ถึงเดือน m
- planBuffer = Σ plannedMonthly(INCOME) − Σ plannedMonthly(FIXED) − Σ plannedMonthly(VARIABLE) − Σ plannedMonthly(SAVING)

## 10. แนวดีไซน์

- โทน: หมึกน้ำเงินเข้มเป็นหลัก + ทองอำพันเป็น accent ของเงินเก็บ/เป้าหมาย + เขียวหยกสำหรับค่าบวก + แดงอุ่นสำหรับเกินงบ; พื้นหลังขาวเทาเย็น (เลี่ยงโทนครีม-เซริฟแบบ template)
  - paper `#F5F6F8`, card `#FFFFFF`, ink `#1B2A4A`, gold `#D8A24A`, jade `#2F8F83`, warn `#C0492F`, muted `#6B7280`
- ฟอนต์: ตัวเลขเงินใช้ monospace (เช่น IBM Plex Mono); ข้อความไทยใช้ฟอนต์ไทยอ่านง่าย (เช่น IBM Plex Sans Thai)
- signature element: แทร็คความคืบหน้าเงินเก็บที่มีหมุดเดือนจาก startDate→targetDate และธงปลายทางที่ยอดเป้า
- responsive ลงมือถือ, focus state ชัดเจน, เคารพ prefers-reduced-motion

## 11. คำสั่งรัน

```bash
npm install
# ตั้งค่า env: DATABASE_URL, AUTH_SECRET (ดู .env.example)
npx prisma migrate dev --name init
npx prisma db seed        # สร้าง demo user + Plan ตัวอย่าง
npm run dev               # http://localhost:3000
```

## 12. ข้อกำหนดเพิ่มเติม

- UI ภาษาไทย, จัดรูปแบบเงินด้วย `Intl.NumberFormat` ตาม currency ของ Plan (default THB → ฿)
- TypeScript strict, migration + seed รันซ้ำได้ (idempotent)
- เก็บ amount เป็นค่าบวกเสมอ ตีความทิศทางจาก category.type
- รองรับหลาย currency ในระดับ Plan (เก็บ field ไว้แล้ว แสดงผลตามนั้น)
- เขียน .env.example ให้ครบ และ README สั้นๆ วิธีรัน

## 13. Implemented features (เพิ่มหลัง scaffold)

ทุกฟีเจอร์: logic คำนวณอยู่ฝั่ง server (`src/lib/calc.ts` แบบ pure หรือ `src/lib/*.ts` ที่แตะ DB),
ทุก query/mutation scope ตาม session user + ต่อ Plan, ใช้ design tokens เดิม, เงินเป็น monospace,
เคารพ `prefers-reduced-motion`.

### 1) Recurring transactions (รายการประจำ)
- model `RecurringRule { planId, categoryId, amount, description, dayOfMonth, startDate, endDate?, active }`
  + `Transaction.sourceRuleId` (onDelete `SetNull` → ลบกฎแล้วรายการที่สร้างแล้วยังอยู่)
- materialize แบบ lazy ที่ `src/lib/recurring.ts`: ตอนโหลดแดชบอร์ด/หน้า log (`loadOwnedPlan` default `materialize:true`)
  จะสร้าง Transaction ที่ถึงกำหนดจาก startDate ถึงเดือนปัจจุบัน — idempotent (กันซ้ำด้วย `sourceRuleId`+เดือน),
  ไม่สร้างเกิน `endDate`, clamp `dayOfMonth` กับวันสุดท้ายของเดือน
- รายการที่สร้างแล้วเป็น Transaction ปกติ แก้/ลบทีละรายการได้ (มี badge "ประจำ" ในตาราง)
- UI: `RecurringManager` บนหน้า log — สร้าง/แก้/หยุด(`active=false`)/ลบ + ปุ่ม "สร้างรายการประจำของเดือนนี้"
- actions: `src/app/actions/recurring.ts`

### 2) Projected completion date (คาดการณ์วันถึงเป้า)
- `projectCompletion()` ใน calc.ts: `pace` = ค่าเฉลี่ย SAVING ต่อเดือนจาก ≤3 เดือนล่าสุดที่มีข้อมูล;
  `projectedDate = today + remaining/pace เดือน`
- แดชบอร์ดแสดงวันคาดการณ์ + เทียบ `targetDate` เป็นจำนวนวันเร็ว/ช้า (เขียวถ้าทัน/เร็ว, แดงถ้าช้า)
- edge: `pace<=0` → "ยังเก็บเงินไม่พอจะคาดการณ์", ครบเป้าแล้ว → completed state

### 3) Milestones + celebration + streak
- milestone 25/50/75/100% เป็น badge บนแดชบอร์ด (ที่ถึงแล้ว highlight)
- `Plan.celebratedMilestones Int[]` เก็บ % ที่ฉลองแล้ว → confetti ยิงครั้งเดียวต่อ milestone, ไม่ซ้ำ,
  ปิดเมื่อ `prefers-reduced-motion` (`MilestoneCelebration` + `markMilestonesCelebratedAction`)
- `savingStreak()`: จำนวนเดือนติดต่อกัน (นับจากเดือนล่าสุดที่มีข้อมูล) ที่ SAVING จริง ≥ plannedMonthly ของ SAVING

### 4) Plan vs actual by category (แผนเทียบจริง)
- หน้า `/plans/[id]/insights` + tab: ต่อหมวดแสดง plannedMonthly เทียบ actual ของเดือนที่เลือก
  (default = เดือนปัจจุบัน), ส่วนต่าง, % การใช้งบ, แถบเทียบ planned/actual
- หมวดที่เกินงบเป็นสีแดง (warn); `MonthSelect` จำกัดช่วง startDate→targetDate
- `categoryComparison()` ใน calc.ts

### 5) Variable expense trend (เทรนด์รายจ่ายผันแปร)
- หน้า `/plans/[id]/trend` + tab: Recharts area รวมรายจ่าย VARIABLE ต่อเดือนตลอดช่วงแผน
- toggle "แยกตามหมวด" → line chart หลายเส้นต่อหมวด VARIABLE
- แสดงการเปลี่ยนแปลงเทียบเดือนก่อน (▲/▼ %, แดง=เพิ่ม จ่ายมากขึ้น / เขียว=ลด)
- `variableTrend()` ใน calc.ts

### 6) Cross-plan overview (ภาพรวมทุกเป้าหมาย)
- หน้า `/overview` (landing หลังล็อกอิน, middleware ป้องกัน): รวมข้ามทุก Plan ที่ active ของ user
- `crossPlanOverview()` ใน calc.ts: รวม savedSoFar/target, %คืบหน้ารวม,
  `requiredPerMonth` = Σ avgNeededPerMonth, `actualMonthlySaving` = เฉลี่ย SAVING รวมทุกแผน
  3 เดือนล่าสุดที่มีข้อมูล; ถ้า required > actual → เตือน "เก็บไม่ทันทุกเป้าหมาย" + ยอดที่ขาด
- การ์ดต่อแผน (ชื่อ, %, saved/target, วันครบ, ตามแผน/ช้า) เรียงตาม targetDate ใกล้สุดก่อน
- คิดเฉพาะ SAVING + remaining/target ข้ามแผน — **ไม่รวม** income/fixed (per-plan, กันนับซ้ำ)
- ไม่เพิ่ม schema (ไม่ทำ `priority`); `getActiveUserPlansFull()` loader, shared `AppShell` (nav ภาพรวม/เป้าหมาย)

### 7) Safe-to-spend this month (ใช้จ่ายได้อีกเดือนนี้ — ต่อ Plan)
- การ์ดเด่นบนแดชบอร์ด: `safeToSpend` = plannedIncome − plannedFixed − savingTarget − actualVariableThisMonth
  (เขียวบวก / แดงลบ = ใช้เกินกินเงินเก็บ) + `safePerDay` = safeToSpend / วันที่เหลือในเดือน
- `safeToSpend()` ใน calc.ts (reuse `budgetRollup`)

### 8) Behavioral spending insights (พฤติกรรมการใช้จ่าย — ต่อ Plan)
- การ์ดบนแดชบอร์ด เดือนปัจจุบัน: ใช้จ่าย (FIXED+VARIABLE) เทียบเดือนก่อน (%, ▲/▼, แดง=เพิ่ม),
  หมวดที่ใช้มากสุด (ยอด + %ของรายจ่าย), ใช้จ่ายเฉลี่ย/วัน (รวมเดือน ÷ วันที่ผ่านมา)
- `spendingInsights()` ใน calc.ts

## 14. AI features (ผู้ให้บริการ: Google Gemini)

> **AI provider = Gemini** (`@google/genai`, default model `gemini-2.5-flash`, override ด้วย `GEMINI_MODEL`)
> ทุก call อยู่ฝั่ง server เท่านั้น (`src/app/actions/ai.ts`) — key อ่านจาก `GEMINI_API_KEY`
> ไม่หลุดถึง client. ถ้าไม่ตั้ง key ฟีเจอร์ AI ถูกซ่อน/คืน error อย่างนุ่มนวล
> **กฎเด็ดขาด (ทุก prompt ย้ำไว้): โมเดลห้ามคิดเลข/แต่งตัวเลข** — เราคำนวณเลขทั้งหมดเอง
> โมเดลแค่แยกข้อความหรือเขียนคำอธิบายจากตัวเลขที่เราส่งให้
> `src/lib/gemini.ts` = client (`getGemini`, `isGeminiConfigured`, `GEMINI_MODEL`)

### A) Natural-language transaction entry + auto-categorize
- หน้า log: ช่องพิมพ์ข้อความอิสระภาษาไทย (เช่น "ข้าวเที่ยง 120 เมื่อวาน", "จ่ายค่าเน็ต 600")
- `parseTransactionAction`: ส่งชื่อหมวด+type, วันที่วันนี้, ข้อความ → Gemini ตอบ JSON structured
  (`responseMimeType: application/json` + `responseSchema`): { date, categoryName, amount, description }
- **validate/normalize ในโค้ดเราเอง**: amount เป็นเลขบวก, แปลง/clamp วันที่ ≤ วันนี้,
  จับ categoryName เข้าหมวดจริงของแผน (exact → contains → fallback VARIABLE/แรก)
- แสดงผลเป็นฟอร์ม prefilled แก้ได้ — ผู้ใช้ยืนยันก่อนบันทึก (ไม่ auto-save), บันทึกผ่าน `addTransactionAction` เดิม
- auto-categorize: ปุ่ม "✨ ให้ AI แนะนำหมวด" ในฟอร์มปกติ → `suggestCategoryAction` (เป็นแค่คำแนะนำ ผู้ใช้เปลี่ยนได้)
- UI: `AiQuickEntry` (แสดงเมื่อมี key), guard = เรียกเฉพาะตอนกดปุ่ม ไม่เรียกตอนโหลดหน้า

### B) Monthly AI coach summary
- model `InsightSummary { planId, month "YYYY-MM", content, generatedAt, @@unique([planId, month]) }`
  + `User.aiOptIn Boolean` (migration `ai_insight_summary`)
- `coachFigures()` ใน calc.ts รวมเลขที่คำนวณแล้ว (reuse `planSummary`/`spendingInsights`/`projectCompletion`/
  `categoryComparison`): รายรับ-จ่ายรวม, %เทียบเดือนก่อน, หมวดใช้มากสุด, เฉลี่ย/วัน, %คืบหน้าเก็บเงิน,
  avgNeededPerMonth, วันคาดการณ์ vs targetDate, ส่วนต่างงบเด่นสุด
- `generateCoachSummaryAction`: ส่ง **เฉพาะตัวเลขเหล่านี้** + prompt ภาษาไทยให้เขียนสรุปสั้นๆ เป็นกันเอง
  (เดือนนี้เป็นไง เงินรั่วตรงไหน ข้อแนะนำ 2-3 ข้อ) ย้ำห้ามคิดเลข → cache ลง `InsightSummary`
- แดชบอร์ด: แสดงสรุปที่ cache ไว้ + ปุ่ม "สร้างสรุปใหม่"; เรียกเฉพาะตอนกด (ไม่เรียกอัตโนมัติ)
- **opt-in + privacy**: ก่อนใช้ครั้งแรกแสดงคำชี้แจงว่าจะส่งตัวเลขสรุปการเงินไป Gemini แล้วต้องกดยินยอม
  (`setAiOptInAction` → `User.aiOptIn`); UI: `CoachSummary`, state จาก `getCoachState`
