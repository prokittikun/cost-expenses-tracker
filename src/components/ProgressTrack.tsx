import { formatMoney, formatMonthLabel } from "@/lib/format";

// Signature element: savings progress track with month pins from startDate→targetDate
// and a destination flag at the target amount.
export function ProgressTrack({
  months,
  progress, // 0..1 capped
  currency,
  targetAmount,
}: {
  months: string[];
  progress: number;
  currency: string;
  targetAmount: number;
}) {
  const pct = Math.round(progress * 100);
  return (
    <div className="w-full">
      <div className="relative h-3 w-full rounded-full bg-ink/10">
        <div
          className="absolute left-0 top-0 h-3 rounded-full bg-gold transition-[width] duration-500"
          style={{ width: `${Math.min(pct, 100)}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {months.map((m) => (
            <span key={m} className="text-[11px] text-muted tabular">
              {formatMonthLabel(m)}
            </span>
          ))}
        </div>
        <span className="ml-2 shrink-0 text-sm font-semibold text-gold tabular">
          🏁 {formatMoney(targetAmount, currency)}
        </span>
      </div>
    </div>
  );
}
