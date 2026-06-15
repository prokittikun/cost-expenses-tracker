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

// ── Projected completion (Feature 2) ───────────────────────────────────────
// pace = average monthly SAVING over the last up-to-3 months that actually have
// SAVING data. projectedDate = today + (remaining / pace) months.

export type Projection =
  | { status: "complete" }
  | { status: "no-pace" } // pace <= 0: not enough saving yet to project
  | {
      status: "projecting";
      pace: number; // avg saving per month used
      projectedDate: Date;
      // +ahead / -behind, in whole days, vs the plan's targetDate
      daysVsTarget: number;
    };

export function projectCompletion(
  plan: PlanInput,
  now: Date = new Date(),
): Projection {
  const summary = planSummary(plan, now);
  if (summary.remaining <= 0) return { status: "complete" };

  // SAVING totals per month, only months that have any saving recorded.
  const byMonth = new Map<string, number>();
  for (const t of plan.transactions) {
    if (t.type !== "SAVING") continue;
    const ym = monthKey(t.date);
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + t.amount);
  }
  const monthsWithData = Array.from(byMonth.entries())
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const recent = monthsWithData.slice(-3); // last up to 3 months with data
  if (recent.length === 0) return { status: "no-pace" };

  const pace = recent.reduce((s, [, v]) => s + v, 0) / recent.length;
  if (pace <= 0) return { status: "no-pace" };

  const monthsNeeded = summary.remaining / pace;
  const projectedDate = new Date(now);
  // advance by whole + fractional months
  const wholeMonths = Math.floor(monthsNeeded);
  const fractionDays = Math.round((monthsNeeded - wholeMonths) * 30);
  projectedDate.setMonth(projectedDate.getMonth() + wholeMonths);
  projectedDate.setDate(projectedDate.getDate() + fractionDays);

  const msPerDay = 1000 * 60 * 60 * 24;
  // positive → projected before target (ahead); negative → after target (behind)
  const daysVsTarget = Math.round(
    (plan.targetDate.getTime() - projectedDate.getTime()) / msPerDay,
  );

  return { status: "projecting", pace, projectedDate, daysVsTarget };
}

// ── Milestones + streak (Feature 3) ────────────────────────────────────────

export const MILESTONE_PERCENTS = [25, 50, 75, 100] as const;
export type MilestonePercent = (typeof MILESTONE_PERCENTS)[number];

export type Milestone = { percent: MilestonePercent; reached: boolean };

export function milestones(plan: PlanInput, now: Date = new Date()): Milestone[] {
  const { progress } = planSummary(plan, now);
  const pct = progress * 100;
  return MILESTONE_PERCENTS.map((percent) => ({
    percent,
    reached: pct >= percent,
  }));
}

// Milestones reached but not yet present in `celebrated` — the ones whose confetti
// should fire now. Returned sorted ascending.
export function newlyReachedMilestones(
  plan: PlanInput,
  celebrated: number[],
  now: Date = new Date(),
): MilestonePercent[] {
  const set = new Set(celebrated);
  return milestones(plan, now)
    .filter((m) => m.reached && !set.has(m.percent))
    .map((m) => m.percent);
}

// streak = consecutive months, counting back from the latest month that has SAVING
// data, where that month's actual SAVING total >= the plan's planned monthly saving.
// If there is no planned saving (target 0), the bar is "any saving > 0".
export function savingStreak(plan: PlanInput): number {
  const plannedSaving = plan.categories
    .filter((c) => c.type === "SAVING")
    .reduce((s, c) => s + c.plannedMonthly, 0);
  const threshold = plannedSaving > 0 ? plannedSaving : Number.MIN_VALUE;

  const byMonth = new Map<string, number>();
  for (const t of plan.transactions) {
    if (t.type !== "SAVING") continue;
    const ym = monthKey(t.date);
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + t.amount);
  }
  const monthsWithData = Array.from(byMonth.keys()).sort();
  if (monthsWithData.length === 0) return 0;

  // Walk consecutive calendar months backward from the latest data month.
  const latest = monthsWithData[monthsWithData.length - 1];
  const [ly, lm] = latest.split("-").map(Number);
  const cursor = new Date(ly, lm - 1, 1);

  let streak = 0;
  while (true) {
    const ym = monthKey(cursor);
    const total = byMonth.get(ym);
    if (total === undefined) break; // gap in months → streak ends
    if (total >= threshold) streak++;
    else break;
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return streak;
}

// ── Plan vs actual by category (Feature 4) ─────────────────────────────────

export type CategoryComparison = {
  categoryId: string;
  name: string;
  type: CategoryType;
  planned: number; // plannedMonthly
  actual: number; // total of this month's transactions in the category
  variance: number; // actual - planned
  usedRatio: number | null; // actual / planned, null when planned == 0
  overBudget: boolean; // only meaningful for expense categories
};

// For a given "YYYY-MM", compare each category's plannedMonthly to its actual total.
// `overBudget` flags FIXED/VARIABLE categories where actual exceeds planned (planned>0).
export function categoryComparison(
  plan: PlanInput,
  ym: string,
): CategoryComparison[] {
  const actualByCat = new Map<string, number>();
  for (const t of plan.transactions) {
    if (monthKey(t.date) !== ym) continue;
    actualByCat.set(t.categoryId, (actualByCat.get(t.categoryId) ?? 0) + t.amount);
  }

  return [...plan.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => {
      const actual = actualByCat.get(c.id) ?? 0;
      const planned = c.plannedMonthly;
      const isExpense = c.type === "FIXED" || c.type === "VARIABLE";
      return {
        categoryId: c.id,
        name: c.name,
        type: c.type,
        planned,
        actual,
        variance: actual - planned,
        usedRatio: planned > 0 ? actual / planned : null,
        overBudget: isExpense && planned > 0 && actual > planned,
      };
    });
}

// ── Variable expense trend (Feature 5) ─────────────────────────────────────

export type VariableTrend = {
  months: string[]; // YYYY-MM across the plan range
  total: number[]; // total VARIABLE spend per month (aligned with months)
  perCategory: { categoryId: string; name: string; values: number[] }[];
  // change of total vs previous month for the latest month with any data
  latest: {
    ym: string;
    total: number;
    prevTotal: number;
    deltaRatio: number | null; // null when prev is 0
  } | null;
};

export function variableTrend(plan: PlanInput): VariableTrend {
  const months = monthRange(plan.startDate, plan.targetDate);
  const monthIndex = new Map(months.map((m, i) => [m, i]));
  const variableCats = plan.categories
    .filter((c) => c.type === "VARIABLE")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const total = new Array(months.length).fill(0) as number[];
  const perCatValues = new Map<string, number[]>();
  for (const c of variableCats) {
    perCatValues.set(c.id, new Array(months.length).fill(0) as number[]);
  }

  for (const t of plan.transactions) {
    if (t.type !== "VARIABLE") continue;
    const idx = monthIndex.get(monthKey(t.date));
    if (idx === undefined) continue;
    total[idx] += t.amount;
    const arr = perCatValues.get(t.categoryId);
    if (arr) arr[idx] += t.amount;
  }

  const perCategory = variableCats.map((c) => ({
    categoryId: c.id,
    name: c.name,
    values: perCatValues.get(c.id)!,
  }));

  // latest month that has any variable spend, and its change vs the prior month
  let latest: VariableTrend["latest"] = null;
  for (let i = total.length - 1; i >= 0; i--) {
    if (total[i] > 0) {
      const prevTotal = i > 0 ? total[i - 1] : 0;
      latest = {
        ym: months[i],
        total: total[i],
        prevTotal,
        deltaRatio: prevTotal > 0 ? (total[i] - prevTotal) / prevTotal : null,
      };
      break;
    }
  }

  return { months, total, perCategory, latest };
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
