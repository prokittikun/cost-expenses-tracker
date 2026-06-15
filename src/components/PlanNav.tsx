"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PlanNav({ planId }: { planId: string }) {
  const pathname = usePathname();
  const base = `/plans/${planId}`;
  const tabs = [
    { href: base, label: "แดชบอร์ด" },
    { href: `${base}/budget`, label: "งบประมาณ" },
    { href: `${base}/log`, label: "บันทึกรายการ" },
    { href: `${base}/summary`, label: "สรุปรายเดือน" },
    { href: `${base}/insights`, label: "แผนเทียบจริง" },
    { href: `${base}/trend`, label: "เทรนด์ค่าใช้จ่าย" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-ink/10">
      {tabs.map((t) => {
        const active =
          t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-gold text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
