import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-ink">ไม่พบหน้านี้</h1>
      <p className="mt-2 text-muted">
        หน้าที่คุณค้นหาไม่มีอยู่ หรือคุณไม่มีสิทธิ์เข้าถึง
      </p>
      <div className="mt-6">
        <LinkButton href="/plans" variant="gold">
          ไปที่เป้าหมายของฉัน
        </LinkButton>
      </div>
    </main>
  );
}
