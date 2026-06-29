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
  amount: number; // always positive; direction comes from type / isWithdrawal
  // For SAVING transactions: true = เบิกออก (subtracts from the pot) instead of
  // a deposit. Lets savedSoFar / chart / projection reflect the real balance.
  isWithdrawal?: boolean;
};

// Signed contribution of a transaction to the savings pot. Deposits add,
// withdrawals subtract; non-SAVING contributes 0.
export function savingDelta(t: CalcTransaction): number {
  if (t.type !== "SAVING") return 0;
  return t.isWithdrawal ? -t.amount : t.amount;
}

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
  savedSoFar: number; // net = grossSaved − withdrawn
  grossSaved: number; // total ever deposited
  withdrawn: number; // total withdrawn from the pot
  remaining: number;
  progress: number; // 0..1, uncapped (based on net)
  progressCapped: number; // 0..1
  monthsRemaining: number;
  avgNeededPerMonth: number;
};

export function planSummary(plan: PlanInput, now: Date = new Date()): PlanSummary {
  let grossSaved = 0;
  let withdrawn = 0;
  for (const t of plan.transactions) {
    if (t.type !== "SAVING") continue;
    if (t.isWithdrawal) withdrawn += t.amount;
    else grossSaved += t.amount;
  }
  const savedSoFar = grossSaved - withdrawn; // net pot balance
  const remaining = Math.max(plan.targetAmount - savedSoFar, 0);
  const progress = plan.targetAmount > 0 ? savedSoFar / plan.targetAmount : 0;
  const mr = monthsRemaining(plan.targetDate, now);
  return {
    savedSoFar,
    grossSaved,
    withdrawn,
    remaining,
    progress,
    // clamp to [0,1]: over-withdrawing can push net below 0
    progressCapped: Math.max(Math.min(progress, 1), 0),
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
  net: number; // this month's flow: income − expense − saving
  cumulativeNet: number; // running carry-over of net (spendable cash to date)
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
    else if (t.type === "SAVING") b.saving += savingDelta(t); // net (deposit − withdraw)
  }

  let cumulativeSaving = 0;
  let cumulativeNet = 0;
  return range.map((ym) => {
    const b = init.get(ym)!;
    const net = b.income - b.expense - b.saving;
    cumulativeSaving += b.saving;
    cumulativeNet += net; // carry leftover cash forward month to month
    return {
      ym,
      income: b.income,
      expense: b.expense,
      saving: b.saving,
      net,
      cumulativeNet,
      cumulativeSaving,
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

  // Net SAVING per month (deposits − withdrawals), months with any movement.
  const byMonth = new Map<string, number>();
  for (const t of plan.transactions) {
    if (t.type !== "SAVING") continue;
    const ym = monthKey(t.date);
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + savingDelta(t));
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
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + savingDelta(t)); // net per month
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

// ── Safe-to-spend this month (Feature 2) ───────────────────────────────────
// safeToSpend = plannedIncome − plannedFixed − savingTarget − actualVariableThisMonth
// What's left to spend on variable categories this month before dipping into savings.

export type SafeToSpend = {
  plannedIncome: number;
  plannedFixed: number;
  savingTarget: number;
  actualVariable: number;
  safeToSpend: number;
  daysRemaining: number; // including today
  safePerDay: number;
};

export function safeToSpend(plan: PlanInput, now: Date = new Date()): SafeToSpend {
  const budget = budgetRollup(plan.categories); // reuse planned rollups
  const ym = monthKey(now);
  const actualVariable = plan.transactions
    .filter((t) => t.type === "VARIABLE" && monthKey(t.date) === ym)
    .reduce((s, t) => s + t.amount, 0);

  const value =
    budget.income - budget.fixed - budget.saving - actualVariable;

  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const daysRemaining = Math.max(daysInMonth - now.getDate() + 1, 1); // include today

  return {
    plannedIncome: budget.income,
    plannedFixed: budget.fixed,
    savingTarget: budget.saving,
    actualVariable,
    safeToSpend: value,
    daysRemaining,
    safePerDay: value / daysRemaining,
  };
}

// ── Behavioral spending insights (Feature 3) ───────────────────────────────
// Spending = FIXED + VARIABLE actual transactions. Defaults to the current month.

export type SpendingInsights = {
  ym: string;
  monthTotal: number; // this month's expenses
  prevTotal: number; // previous month's expenses
  momChangeRatio: number | null; // (cur - prev)/prev; null when prev == 0
  topCategory: { name: string; amount: number; share: number } | null; // share 0..1
  avgDaily: number; // monthTotal / days elapsed
};

export function spendingInsights(
  plan: PlanInput,
  now: Date = new Date(),
): SpendingInsights {
  const ym = monthKey(now);
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = monthKey(prevDate);
  const isExpense = (t: CalcTransaction) =>
    t.type === "FIXED" || t.type === "VARIABLE";

  const catName = new Map(plan.categories.map((c) => [c.id, c.name]));

  let monthTotal = 0;
  let prevTotal = 0;
  const byCat = new Map<string, number>();
  for (const t of plan.transactions) {
    if (!isExpense(t)) continue;
    const tym = monthKey(t.date);
    if (tym === ym) {
      monthTotal += t.amount;
      byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
    } else if (tym === prevYm) {
      prevTotal += t.amount;
    }
  }

  // top spending category this month
  let topCategory: SpendingInsights["topCategory"] = null;
  for (const [catId, amount] of byCat) {
    if (!topCategory || amount > topCategory.amount) {
      topCategory = {
        name: catName.get(catId) ?? "—",
        amount,
        share: monthTotal > 0 ? amount / monthTotal : 0,
      };
    }
  }

  // days elapsed this month: if `now` is the current month, days up to today;
  // otherwise the full month length.
  const daysElapsed =
    now.getFullYear() === new Date().getFullYear() &&
    now.getMonth() === new Date().getMonth()
      ? now.getDate()
      : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return {
    ym,
    monthTotal,
    prevTotal,
    momChangeRatio: prevTotal > 0 ? (monthTotal - prevTotal) / prevTotal : null,
    topCategory,
    avgDaily: daysElapsed > 0 ? monthTotal / daysElapsed : 0,
  };
}

// ── Coach summary figures (AI feature B) ───────────────────────────────────
// Bundles deterministically-computed numbers for one month. These are the ONLY
// figures handed to Gemini — the model writes prose, never math.

export type CoachFigures = {
  month: string;
  currency: string;
  totalIncome: number;
  totalExpense: number; // FIXED + VARIABLE this month
  momSpendingChangePct: number | null; // vs previous month, percent (e.g. 15 = +15%)
  topCategory: { name: string; amount: number; sharePct: number } | null;
  avgDailySpend: number;
  savingProgressPct: number; // 0..100
  avgNeededPerMonth: number;
  projectedDate: string | null; // ISO date or null
  targetDate: string;
  projectionStatus: Projection["status"];
  daysVsTarget: number | null; // + ahead / - behind
  topVariances: { name: string; planned: number; actual: number; variance: number }[];
};

export function coachFigures(
  plan: PlanWithMeta,
  month: string,
  now: Date = new Date(),
): CoachFigures {
  const summary = planSummary(plan, now);
  const projection = projectCompletion(plan, now);
  const insights = spendingInsights(plan, monthAnchor(month, now));

  // income + expense for the selected month
  let totalIncome = 0;
  for (const t of plan.transactions) {
    if (t.type === "INCOME" && monthKey(t.date) === month) totalIncome += t.amount;
  }

  // largest plan-vs-actual variances (by absolute variance), top 3
  const topVariances = categoryComparison(plan, month)
    .filter((c) => c.type === "FIXED" || c.type === "VARIABLE")
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 3)
    .map((c) => ({
      name: c.name,
      planned: c.planned,
      actual: c.actual,
      variance: c.variance,
    }));

  return {
    month,
    currency: plan.currency,
    totalIncome,
    totalExpense: insights.monthTotal,
    momSpendingChangePct:
      insights.momChangeRatio == null
        ? null
        : Math.round(insights.momChangeRatio * 100),
    topCategory: insights.topCategory
      ? {
          name: insights.topCategory.name,
          amount: insights.topCategory.amount,
          sharePct: Math.round(insights.topCategory.share * 100),
        }
      : null,
    avgDailySpend: insights.avgDaily,
    savingProgressPct: Math.round(summary.progressCapped * 100),
    avgNeededPerMonth: summary.avgNeededPerMonth,
    projectedDate:
      projection.status === "projecting"
        ? projection.projectedDate.toISOString().slice(0, 10)
        : null,
    targetDate: plan.targetDate.toISOString().slice(0, 10),
    projectionStatus: projection.status,
    daysVsTarget:
      projection.status === "projecting" ? projection.daysVsTarget : null,
    topVariances,
  };
}

// Anchor a "YYYY-MM" to a Date inside that month for helpers that key off `now`.
// If it's the current month, keep the real `now` (so "days elapsed" is correct);
// otherwise anchor to that month's last day.
function monthAnchor(month: string, now: Date): Date {
  const [y, m] = month.split("-").map(Number);
  if (now.getFullYear() === y && now.getMonth() === m - 1) return now;
  return new Date(y, m, 0); // last day of that month
}

// ── Cross-plan overview (Feature 1) ────────────────────────────────────────
// Aggregates across the user's active plans. All cross-plan math is based on
// SAVING flows and per-plan remaining/target only — income/fixed are per-plan
// and would double-count, so they are intentionally excluded.

export type PlanWithMeta = PlanInput & {
  id: string;
  name: string;
  currency: string;
};

export type OverviewPlanCard = {
  id: string;
  name: string;
  currency: string;
  savedSoFar: number;
  targetAmount: number;
  targetDate: Date;
  progress: number; // 0..1 capped
  avgNeededPerMonth: number;
  onTrack: boolean; // projection on/ahead of target (true also when complete)
  projectionStatus: Projection["status"];
};

export type CrossPlanOverview = {
  planCount: number;
  totalSaved: number;
  totalTarget: number;
  overallProgress: number; // 0..1 capped
  requiredPerMonth: number; // Σ avgNeededPerMonth over active plans
  actualMonthlySaving: number; // avg monthly SAVING across all plans, last 3 months w/ data
  overCommitted: boolean;
  shortfall: number; // max(required - actual, 0)
  cards: OverviewPlanCard[]; // sorted by soonest targetDate first
};

// Average monthly SAVING across ALL given plans over the last up-to-3 calendar
// months that have any saving data (pooled across plans).
function pooledActualMonthlySaving(
  plans: PlanWithMeta[],
  now: Date = new Date(),
): number {
  const byMonth = new Map<string, number>();
  for (const plan of plans) {
    for (const t of plan.transactions) {
      if (t.type !== "SAVING") continue;
      const ym = monthKey(t.date);
      byMonth.set(ym, (byMonth.get(ym) ?? 0) + savingDelta(t)); // net
    }
  }
  const monthsWithData = Array.from(byMonth.entries())
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(-3);
  if (monthsWithData.length === 0) return 0;
  return (
    monthsWithData.reduce((s, [, v]) => s + v, 0) / monthsWithData.length
  );
}

export function crossPlanOverview(
  plans: PlanWithMeta[],
  now: Date = new Date(),
): CrossPlanOverview {
  let totalSaved = 0;
  let totalTarget = 0;
  let requiredPerMonth = 0;

  const cards: OverviewPlanCard[] = plans.map((plan) => {
    const summary = planSummary(plan, now);
    const projection = projectCompletion(plan, now);
    totalSaved += summary.savedSoFar;
    totalTarget += plan.targetAmount;
    requiredPerMonth += summary.avgNeededPerMonth;

    const onTrack =
      projection.status === "complete" ||
      (projection.status === "projecting" && projection.daysVsTarget >= 0);

    return {
      id: plan.id,
      name: plan.name,
      currency: plan.currency,
      savedSoFar: summary.savedSoFar,
      targetAmount: plan.targetAmount,
      targetDate: plan.targetDate,
      progress: summary.progressCapped,
      avgNeededPerMonth: summary.avgNeededPerMonth,
      onTrack,
      projectionStatus: projection.status,
    };
  });

  // soonest deadline first → user funds the nearest goal first
  cards.sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());

  const actualMonthlySaving = pooledActualMonthlySaving(plans, now);
  const overCommitted = requiredPerMonth > actualMonthlySaving;

  return {
    planCount: plans.length,
    totalSaved,
    totalTarget,
    overallProgress: totalTarget > 0 ? Math.min(totalSaved / totalTarget, 1) : 0,
    requiredPerMonth,
    actualMonthlySaving,
    overCommitted,
    shortfall: Math.max(requiredPerMonth - actualMonthlySaving, 0),
    cards,
  };
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
