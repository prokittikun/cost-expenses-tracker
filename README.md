# Savings Planner — วางแผนเก็บเงิน (multi-user)

เว็บแอป Next.js 15 + Prisma + Auth.js สำหรับวางแผนและติดตามการเก็บเงินแบบหลายผู้ใช้
แต่ละคนสร้าง "เป้าหมาย" (Plan) ของตัวเองได้ไม่จำกัด ระบบคำนวณว่าต้องเก็บเดือนละเท่าไหร่
และติดตามรายรับรายจ่ายจริงเทียบกับแผน

## Tech stack

- Next.js 15 (App Router) + TypeScript strict
- Prisma ORM — SQLite (dev) / PostgreSQL (prod)
- Auth.js (NextAuth v5) + Credentials (bcrypt)
- Tailwind CSS, Recharts

## เริ่มใช้งาน

```bash
npm install

# ตั้งค่า env
cp .env.example .env
# แก้ AUTH_SECRET ใน .env  (สร้างด้วย: npx auth secret  หรือ  openssl rand -base64 32)

# สร้างฐานข้อมูล
npx prisma migrate dev --name init

# seed demo user + แผนตัวอย่าง
npx prisma db seed

# รัน
npm run dev   # http://localhost:3000
```

Demo login: `demo@example.com` / `demo1234`

## โครงสร้างหน้า

- `/` — landing
- `/login`, `/signup` — สมาชิก
- `/plans` — รายการเป้าหมายทั้งหมด
- `/plans/new` — สร้างเป้าหมาย
- `/plans/[id]` — แดชบอร์ด (ความคืบหน้า, งบ, กราฟเงินสะสม, ตั้งค่า/archive/ลบ)
- `/plans/[id]/budget` — แก้หมวดหมู่และงบ/เดือน
- `/plans/[id]/log` — บันทึก/ลบ/กรองรายการ
- `/plans/[id]/summary` — สรุปรายเดือน

## ความปลอดภัย

- รหัสผ่าน hash ด้วย bcrypt เท่านั้น
- middleware ป้องกันทุกหน้าใต้ `/plans`
- ทุก query/mutation ผ่าน `src/lib/data.ts` ที่ scope ตาม session user — ไม่เชื่อ id จาก client

## Docker / Docker Compose

รันทั้ง app + PostgreSQL ในคอนเทนเนอร์ ตอนสตาร์ตจะ `prisma migrate deploy` อัตโนมัติ

```bash
cp .env.example .env       # อย่างน้อยตั้ง AUTH_SECRET
docker compose up -d --build
# เปิด http://localhost:3000
```

Seed demo user + แผนตัวอย่าง ตอนสตาร์ตครั้งแรก:

```bash
SEED_ON_START=true docker compose up -d --build
# login: demo@example.com / demo1234
```

ตัวแปร env ที่ใช้ได้ (override ผ่าน `.env` หรือ inline):

| ตัวแปร | ค่าเริ่มต้น | หมายเหตุ |
|---|---|---|
| `AUTH_SECRET` | — (ต้องตั้ง) | secret ของ Auth.js |
| `POSTGRES_USER/PASSWORD/DB` | `savings` | credential ของ db container |
| `SEED_ON_START` | `false` | seed ตอนสตาร์ต |
| `APP_HOST_PORT` | `3000` | พอร์ต host ของ app |
| `DB_HOST_PORT` | `5433` | พอร์ต host ของ postgres (สำหรับต่อด้วย psql/GUI) |

> app ต่อ db ผ่าน network ภายในด้วยชื่อ service `db` — `DATABASE_URL` ถูกประกอบใน compose
> ไม่ต้องตั้งเอง คำสั่ง: `docker compose logs -f app`, ปิด: `docker compose down` (ลบข้อมูลด้วย: `-v`)

## Deploy เป็น PostgreSQL

แก้ `provider = "postgresql"` ใน `prisma/schema.prisma` และตั้ง `DATABASE_URL` เป็น connection string
(Neon/Supabase) แล้วรัน `npx prisma migrate deploy`

## CI/CD (GitHub Actions → Docker Hub)

สอง workflow ใน `.github/workflows/`:

- **ci.yml** — ทุก push/PR เข้า `main`: `npm ci` → `prisma generate` → `tsc --noEmit` → `next build`
  (ไม่ต่อ DB จริง ใช้ค่า placeholder)
- **docker-publish.yml** — ทุก push เข้า `main` และ tag `v*`: build แล้ว push image
  `prokittikun/cost-expenses-tracker` ขึ้น Docker Hub
  - push `main` → tag `latest` + `sha-<short>`
  - tag `v1.2.3` → tag `1.2.3`, `1.2`, `1`
  - ใช้ GitHub Actions cache เร่ง build

ตั้ง secret ใน repo (Settings → Secrets and variables → Actions):

| Secret | ค่า |
|---|---|
| `DOCKERHUB_USERNAME` | username ของ Docker Hub |
| `DOCKERHUB_TOKEN` | access token (Docker Hub → Account Settings → Security → New Access Token, สิทธิ์ Read/Write) |

ดึง image ไปใช้:

```bash
docker pull prokittikun/cost-expenses-tracker:latest
```

> compose ใช้ image แทน build เอง: เพิ่ม `image: prokittikun/cost-expenses-tracker:latest`
> ในบริการ `app` แล้วเอา `build:` ออก

## โครงสร้างโค้ด

- `src/lib/calc.ts` — สูตรคำนวณทั้งหมด (pure, ไม่มี DB)
- `src/lib/categories.ts` — เทมเพลตหมวดหมู่ + CategoryType
- `src/lib/data.ts` — data-access layer (authorization)
- `src/app/actions/*` — Server Actions (CRUD)
