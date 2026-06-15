// Idempotent seed: one demo user + one sample plan "ทริปจีน ธ.ค. 2026".
// Safe to re-run. No real-user data seeded (CLAUDE.md §6).

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getTemplate } from "../src/lib/categories";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo1234";
const PLAN_NAME = "ทริปจีน ธ.ค. 2026";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo", passwordHash },
  });

  const existing = await prisma.plan.findFirst({
    where: { userId: user.id, name: PLAN_NAME },
  });
  if (existing) {
    console.log("Seed: demo plan already exists, skipping.");
    return;
  }

  const tmpl = getTemplate("general")!;
  const plan = await prisma.plan.create({
    data: {
      userId: user.id,
      name: PLAN_NAME,
      description: "ตัวอย่างแผนเก็บเงินทริป",
      currency: "THB",
      targetAmount: 65000,
      startDate: new Date("2026-06-01"),
      targetDate: new Date("2026-11-30"),
      categories: {
        create: tmpl.categories.map((c, i) => ({
          name: c.name,
          type: c.type,
          plannedMonthly: c.plannedMonthly,
          sortOrder: i,
        })),
      },
    },
    include: { categories: true },
  });

  const cat = (name: string) =>
    plan.categories.find((c) => c.name === name)!.id;

  // a couple of sample transactions to exercise the dashboard/summary
  await prisma.transaction.createMany({
    data: [
      {
        planId: plan.id,
        categoryId: cat("เงินเดือน"),
        date: new Date("2026-06-25"),
        amount: 30000,
        description: "เงินเดือน มิ.ย.",
        note: "",
      },
      {
        planId: plan.id,
        categoryId: cat("เก็บเข้าเป้าหมาย"),
        date: new Date("2026-06-26"),
        amount: 10000,
        description: "เก็บเข้าเป้า มิ.ย.",
        note: "",
      },
      {
        planId: plan.id,
        categoryId: cat("ค่าอาหาร"),
        date: new Date("2026-06-10"),
        amount: 4500,
        description: "ค่าอาหารทั้งเดือน",
        note: "",
      },
      {
        planId: plan.id,
        categoryId: cat("เก็บเข้าเป้าหมาย"),
        date: new Date("2026-07-26"),
        amount: 12000,
        description: "เก็บเข้าเป้า ก.ค.",
        note: "",
      },
    ],
  });

  console.log(`Seed done. Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
