import { LinkButton } from "@/components/ui";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold">
        วางแผนเก็บเงิน
      </span>
      <h1 className="text-4xl font-bold leading-tight text-ink sm:text-5xl">
        ตั้งเป้า แล้วเก็บเงินให้ถึงฝัน
      </h1>
      <p className="mt-4 max-w-xl text-base text-muted">
        สร้างเป้าหมายการเก็บเงินได้ไม่จำกัด — ทริปท่องเที่ยว ของชิ้นใหญ่
        หรือเงินสำรองฉุกเฉิน ระบบคำนวณให้ว่าต้องเก็บเดือนละเท่าไหร่
        แล้วติดตามรายรับรายจ่ายจริงเทียบกับแผน
      </p>
      <div className="mt-8 flex gap-3">
        <LinkButton href="/signup" variant="gold">
          เริ่มใช้งานฟรี
        </LinkButton>
        <LinkButton href="/login" variant="outline">
          เข้าสู่ระบบ
        </LinkButton>
      </div>

      <div className="mt-16 grid w-full gap-4 sm:grid-cols-3">
        {[
          ["ตั้งเป้าได้อิสระ", "กำหนดยอด วันเริ่ม วันครบกำหนดเอง ไม่มีค่าตายตัว"],
          ["คำนวณอัตโนมัติ", "รู้ทันทีว่าต้องเก็บเฉลี่ยเดือนละเท่าไหร่ถึงจะทัน"],
          ["ติดตามจริง", "บันทึกรายรับรายจ่าย เทียบกับแผนทุกเดือน"],
        ].map(([title, body]) => (
          <div
            key={title}
            className="rounded-2xl border border-ink/5 bg-card p-5 text-left shadow-sm"
          >
            <h3 className="font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
