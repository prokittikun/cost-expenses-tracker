import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "สมัครสมาชิก",
  description: "สร้างบัญชีฟรีเพื่อเริ่มวางแผนและติดตามการเก็บเงินตามเป้าหมาย",
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-8 text-sm text-muted hover:text-ink">
        ← กลับหน้าหลัก
      </Link>
      <h1 className="text-2xl font-bold text-ink">สมัครสมาชิก</h1>
      <p className="mt-1 text-sm text-muted">สร้างบัญชีเพื่อเริ่มวางแผนเก็บเงิน</p>
      <div className="mt-6">
        <SignupForm />
      </div>
      <p className="mt-6 text-sm text-muted">
        มีบัญชีแล้ว?{" "}
        <Link href="/login" className="font-medium text-gold hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </main>
  );
}
