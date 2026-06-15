// All per-Plan formulas (CLAUDE.md §9). Pure — no DB. Dates drive everything; nothing hardcoded.

import type { CategoryType } from "./categories";

export type CalcCategory = {
  id: string;
  name: string;
  type: CategoryType;
  plannedMonthly: number;
  sortOrder: number;
};

export type CalcTransaction = {
  id: string;
  categoryId: string;
  type: CategoryType;
  date: Date;
  amount: number;
};

export type PlanInput = {
  targetAmount: number;
  startDate: Date;
  targetDate: Date;
  categories: CalcCategory[];
  transactions: CalcTransaction[];
};

// "YYYY-MM" bucket key (local time).
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Whole calendar months from a→b, inclusive of both endpoints' months. Min 1.
export function monthsBetween(a: Date, b: Date): number {
  const months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  return Math.max(months, 1);
}

// Every "YYYY-MM" from startDate's month → targetDate's month, inclusive.
export function monthRange(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    keys.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys.length ? keys : [monthKey(start)];
}

// Months remaining from `now` to targetDate, rounded up, at least 1.
export function monthsRemaining(targetDate: Date, now: Date = new Date()): number {
  if (targetDate <= now) return 1;
  const monthDiff =
    (targetDate.getFullYear() - now.getFullYear()) * 12 +
    (targetDate.getMonth() - now.getMonth());
  // round up the partial month if the target day-of-month hasn't passed yet
  const adjusted = targetDate.getDate() >= now.getDate() ? monthDiff + 1 : monthDiff;
  return Math.max(adjusted, 1);
}

export type PlanSummary = {
  savedSoFar: number;
  remaining: number;
  progress: number; // 0..1, uncapped
  progressCapped: number; // 0..1
  monthsRemaining: number;
  avgNeededPerMonth: number;
};

export function planSummary(plan: PlanInput, now: Date = new Date()): PlanSummary {
  const savedSoFar = plan.transactions
    .filter((t) => t.type === "SAVING")
    .reduce((s, t) => s + t.amount, 0);
  const remaining = Math.max(plan.targetAmount - savedSoFar, 0);
  const progress = plan.targetAmount > 0 ? savedSoFar / plan.targetAmount : 0;
  const mr = monthsRemaining(plan.targetDate, now);
  return {
    savedSoFar,
    remaining,
    progress,
    progressCapped: Math.min(progress, 1),
    monthsRemaining: mr,
    avgNeededPerMonth: remaining / mr,
  };
}

// Plan-level budget rollup from plannedMonthly.
export type BudgetRollup = {
  income: number;
  fixed: number;
  variable: number;
  saving: number;
  buffer: number;
};

export function budgetRollup(categories: CalcCategory[]): BudgetRollup {
  const sum = (type: CategoryType) =>
    categories.filter((c) => c.type === type).reduce((s, c) => s + c.plannedMonthly, 0);
  const income = sum("INCOME");
  const fixed = sum("FIXED");
  const variable = sum("VARIABLE");
  const saving = sum("SAVING");
  return { income, fixed, variable, saving, buffer: income - fixed - variable - saving };
}

export type MonthBucket = {
  ym: string;
  income: number;
  expense: number;
  saving: number;
  net: number;
  cumulativeSaving: number;
};

// Per-month buckets across the Plan's date range (start→target), with running saving total.
export function monthlyBuckets(plan: PlanInput): MonthBucket[] {
  const range = monthRange(plan.startDate, plan.targetDate);
  const init = new Map<string, { income: number; expense: number; saving: number }>();
  for (const ym of range) init.set(ym, { income: 0, expense: 0, saving: 0 });

  for (const t of plan.transactions) {
    const ym = monthKey(t.date);
    const b = init.get(ym);
    if (!b) continue; // outside plan range → ignored in summary
    if (t.type === "INCOME") b.income += t.amount;
    else if (t.type === "FIXED" || t.type === "VARIABLE") b.expense += t.amount;
    else if (t.type === "SAVING") b.saving += t.amount;
  }

  let cumulative = 0;
  return range.map((ym) => {
    const b = init.get(ym)!;
    cumulative += b.saving;
    return {
      ym,
      income: b.income,
      expense: b.expense,
      saving: b.saving,
      net: b.income - b.expense - b.saving,
      cumulativeSaving: cumulative,
    };
  });
}

// Per-category per-month totals (for the summary expense rows).
export function categoryMonthlyTotals(
  plan: PlanInput,
): Map<string, Map<string, number>> {
  // categoryId -> (ym -> total)
  const out = new Map<string, Map<string, number>>();
  for (const c of plan.categories) out.set(c.id, new Map());
  for (const t of plan.transactions) {
    const ym = monthKey(t.date);
    const byMonth = out.get(t.categoryId);
    if (!byMonth) continue;
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + t.amount);
  }
  return out;
}
