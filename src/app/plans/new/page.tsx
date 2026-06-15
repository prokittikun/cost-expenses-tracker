import Link from "next/link";
import { requireUserId } from "@/lib/data";
import { NewPlanForm } from "./NewPlanForm";

export default async function NewPlanPage() {
  await requireUserId();
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/plans" className="text-sm text-muted hover:text-ink">
        ← กลับ
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink">สร้างเป้าหมายใหม่</h1>
      <p className="mt-1 text-sm text-muted">
        กำหนดยอดที่ต้องเก็บและช่วงเวลา ระบบจะคำนวณให้ว่าต้องเก็บเดือนละเท่าไหร่
      </p>
      <div className="mt-6">
        <NewPlanForm />
      </div>
    </div>
  );
}
