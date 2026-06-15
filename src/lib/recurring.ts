import "server-only";
import { prisma } from "./prisma";
import { monthKey } from "./calc";

// Lazy materialization of recurring rules into concrete Transactions.
//
// For every active rule, walk each month from the rule's startDate month through
// the current month (never past endDate). If no Transaction already exists for
// (rule, month) we create one. Idempotent: dedupe key is (sourceRuleId, YYYY-MM).
// Generated rows are normal Transactions afterwards — editable/deletable by hand.

// Last day of the given year/month (month is 0-based).
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Midnight of the given date's calendar day (local), for day-level comparisons.
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// The dated occurrence for a rule in a given month, clamping dayOfMonth to the
// month's length (e.g. day 31 in February → 28/29).
function occurrenceDate(year: number, month: number, dayOfMonth: number): Date {
  const day = Math.min(dayOfMonth, lastDayOfMonth(year, month));
  return new Date(year, month, day);
}

// Iterate first-of-month dates from `start` month to `end` month inclusive.
function* monthIter(start: Date, end: Date): Generator<{ year: number; month: number }> {
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    yield { year: cur.getFullYear(), month: cur.getMonth() };
    cur.setMonth(cur.getMonth() + 1);
  }
}

export type MaterializeResult = { created: number };

// Generate due transactions for one plan's active rules up to `now`.
// Pass a single ruleId to limit work to one rule (used by manual "generate" button).
export async function materializeRecurring(
  planId: string,
  now: Date = new Date(),
  onlyRuleId?: string,
): Promise<MaterializeResult> {
  const rules = await prisma.recurringRule.findMany({
    where: {
      planId,
      active: true,
      ...(onlyRuleId ? { id: onlyRuleId } : {}),
    },
  });
  if (rules.length === 0) return { created: 0 };

  // Existing generated rows for these rules, keyed by `${ruleId}:${YYYY-MM}`.
  const ruleIds = rules.map((r) => r.id);
  const existing = await prisma.transaction.findMany({
    where: { planId, sourceRuleId: { in: ruleIds } },
    select: { sourceRuleId: true, date: true },
  });
  const seen = new Set(
    existing.map((t) => `${t.sourceRuleId}:${monthKey(t.date)}`),
  );

  // Occurrences the user deleted by hand — treat as already-handled so we don't
  // recreate them. Keyed the same way: `${ruleId}:${YYYY-MM}`.
  const skips = await prisma.recurringSkip.findMany({
    where: { ruleId: { in: ruleIds } },
    select: { ruleId: true, ym: true },
  });
  for (const s of skips) seen.add(`${s.ruleId}:${s.ym}`);

  const toCreate: {
    planId: string;
    categoryId: string;
    date: Date;
    amount: number;
    description: string;
    note: string;
    sourceRuleId: string;
  }[] = [];

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const rule of rules) {
    // Walk from the rule's start month to the current month, but never past endDate.
    let end = currentMonthStart;
    if (rule.endDate) {
      const endMonthStart = new Date(
        rule.endDate.getFullYear(),
        rule.endDate.getMonth(),
        1,
      );
      if (endMonthStart < end) end = endMonthStart;
    }
    if (end < new Date(rule.startDate.getFullYear(), rule.startDate.getMonth(), 1)) {
      continue; // window empty (endDate before startDate month)
    }

    for (const { year, month } of monthIter(rule.startDate, end)) {
      const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
      if (seen.has(`${rule.id}:${ym}`)) continue;
      const date = occurrenceDate(year, month, rule.dayOfMonth);
      // Date gate: only create once today has reached the occurrence's day.
      // Past months are always due; the current (or any future) month waits until
      // today >= its dayOfMonth. Compare by calendar day, ignoring clock time.
      if (startOfDay(date) > startOfDay(now)) continue;
      toCreate.push({
        planId,
        categoryId: rule.categoryId,
        date,
        amount: rule.amount,
        description: rule.description,
        note: "",
        sourceRuleId: rule.id,
      });
    }
  }

  if (toCreate.length === 0) return { created: 0 };
  // createMany is safe here: each (rule, month) was checked against `seen`.
  const res = await prisma.transaction.createMany({ data: toCreate });
  return { created: res.count };
}
