// Money formatting per Plan currency (default THB → ฿). Date helpers in Thai locale.

export function formatMoney(amount: number, currency = "THB"): string {
  try {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
  }
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(amount);
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio);
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatMonthLabel(ym: string): string {
  // ym = "YYYY-MM"
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("th-TH", {
    year: "2-digit",
    month: "short",
  }).format(date);
}

// <input type="date"> value (YYYY-MM-DD) from a Date.
export function toDateInputValue(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
