"use client";

import { useRouter } from "next/navigation";
import { formatMonthLabel } from "@/lib/format";
import { inputClass } from "./ui";

// Month picker limited to a plan's month range. Navigates to `${basePath}?month=YYYY-MM`.
export function MonthSelect({
  basePath,
  months,
  selected,
}: {
  basePath: string;
  months: string[];
  selected: string;
}) {
  const router = useRouter();
  return (
    <select
      value={selected}
      onChange={(e) => router.push(`${basePath}?month=${e.target.value}`)}
      className={`${inputClass} w-auto`}
      aria-label="เลือกเดือน"
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {formatMonthLabel(m)}
        </option>
      ))}
    </select>
  );
}
