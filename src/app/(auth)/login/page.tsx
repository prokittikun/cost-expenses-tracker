import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-8 text-sm text-muted hover:text-ink">
        ← กลับหน้าหลัก
      </Link>
      <h1 className="text-2xl font-bold text-ink">เข้าสู่ระบบ</h1>
      <p className="mt-1 text-sm text-muted">ยินดีต้อนรับกลับมา</p>
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-6 text-sm text-muted">
        ยังไม่มีบัญชี?{" "}
        <Link href="/signup" className="font-medium text-gold hover:underline">
          สมัครสมาชิก
        </Link>
      </p>
    </main>
  );
}
