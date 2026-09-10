import type { MonthlyCategory, MonthlyEntry } from "@prisma/client";
import { prisma } from "@/lib/db";

// An entry counts as "unpaid" for breakdown purposes when its Actual hasn't
// been recorded yet. Skipped entries are never unpaid — they were
// deliberately excluded from the month, not missed.
export function isEntryUnpaid(entry: { actualAmount: string | null; isSkipped: boolean }): boolean {
  return !entry.isSkipped && entry.actualAmount === null;
}

export type MonthlyBreakdown = {
  categoryBreakup: { categoryId: string; name: string; actualSpend: number }[]; // OUTFLOW only, actual (fallback to planned if unrecorded), skipped excluded
  totalSpend: number;

  variance: {
    categoryId: string;
    name: string;
    baseTotal: number;
    plannedTotal: number;
    actualTotal: number; // fallback-to-planned convention
    varianceAmount: number; // actualTotal - plannedTotal
    variancePercent: number; // varianceAmount / plannedTotal, 0 if plannedTotal is 0
  }[]; // sorted by varianceAmount descending (biggest overshoot first)

  waterfall: {
    income: number;
    fixedExpenses: number;
    variableExpenses: number;
    savings: number; // income - fixedExpenses - variableExpenses; can be negative
  };

  deltaVsPreviousMonth: {
    totalSpendChange: number; // this month's totalSpend - previous month's totalSpend
    totalSpendChangePercent: number; // 0 if previous month's totalSpend is 0
    topMovers: {
      categoryId: string;
      name: string;
      change: number; // this month - previous month, signed
    }[]; // top 3 by absolute value of change, descending
  };

  subscriptions: {
    total: number; // sum of actualTotal (fallback-to-planned) across isSubscription categories
    hasPriceHike: boolean; // true if any isSubscription category has actualTotal > baseTotal for this period
  };

  unpaid: {
    categoryId: string;
    categoryName: string;
    entryName: string;
    plannedAmount: number;
    dueStatus: "current" | "overdue"; // "overdue" if this is the Previous Month view, "current" if Current Month
  }[];
};

// actual-with-fallback: the same "not yet recorded counts as planned" idea
// used by computeMonthlySummary, applied here to a single entry.
function actualFor(entry: Pick<MonthlyEntry, "plannedAmount" | "actualAmount">): number {
  const planned = Number(entry.plannedAmount);
  return entry.actualAmount == null ? planned : Number(entry.actualAmount);
}

// Subtracts one calendar month from the given period — deliberately not
// getPreviousPeriod, which is anchored to *today*, not to whatever period is
// being requested (Current or Previous Month).
function previousCalendarMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export async function getMonthBreakdown(
  householdId: string,
  year: number,
  month: number,
  opts: { periodKind: "current" | "previous" }
): Promise<MonthlyBreakdown> {
  const prev = previousCalendarMonth(year, month);

  const [categories, entries, prevEntries] = await Promise.all([
    prisma.monthlyCategory.findMany({ where: { householdId } }),
    prisma.monthlyEntry.findMany({
      where: { householdId, year, month },
      orderBy: { createdAt: "asc" },
    }),
    prisma.monthlyEntry.findMany({
      where: { householdId, year: prev.year, month: prev.month },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const categoryById = new Map<string, MonthlyCategory>(categories.map((c) => [c.id, c]));
  const nameFor = (categoryId: string) => categoryById.get(categoryId)?.name ?? "";

  // Skipped entries were deliberately excluded from the month, not missed —
  // same convention as computeMonthlySummary.
  const activeEntries = entries.filter((e) => !e.isSkipped);
  const prevActiveEntries = prevEntries.filter((e) => !e.isSkipped);

  // --- categoryBreakup / totalSpend: OUTFLOW only ---
  const outflowEntries = activeEntries.filter((e) => categoryById.get(e.categoryId)?.type === "OUTFLOW");
  const spendByCategory = new Map<string, number>();
  for (const e of outflowEntries) {
    spendByCategory.set(e.categoryId, (spendByCategory.get(e.categoryId) ?? 0) + actualFor(e));
  }
  const categoryBreakup = [...spendByCategory.entries()].map(([categoryId, actualSpend]) => ({
    categoryId,
    name: nameFor(categoryId),
    actualSpend,
  }));
  const totalSpend = categoryBreakup.reduce((sum, c) => sum + c.actualSpend, 0);

  // --- variance: every category (Income and Outflow) with entries this period ---
  const varianceTotals = new Map<string, { baseTotal: number; plannedTotal: number; actualTotal: number }>();
  for (const e of activeEntries) {
    const t = varianceTotals.get(e.categoryId) ?? { baseTotal: 0, plannedTotal: 0, actualTotal: 0 };
    t.baseTotal += Number(e.baseAmount);
    t.plannedTotal += Number(e.plannedAmount);
    t.actualTotal += actualFor(e);
    varianceTotals.set(e.categoryId, t);
  }
  const variance = [...varianceTotals.entries()]
    .map(([categoryId, t]) => {
      const varianceAmount = t.actualTotal - t.plannedTotal;
      const variancePercent = t.plannedTotal === 0 ? 0 : varianceAmount / t.plannedTotal;
      return { categoryId, name: nameFor(categoryId), ...t, varianceAmount, variancePercent };
    })
    .sort((a, b) => b.varianceAmount - a.varianceAmount);

  // --- waterfall ---
  let income = 0;
  let fixedExpenses = 0;
  let variableExpenses = 0;
  for (const e of activeEntries) {
    const category = categoryById.get(e.categoryId);
    if (!category) continue;
    const amount = actualFor(e);
    if (category.type === "INCOME") {
      income += amount;
    } else if (category.spendKind === "FIXED") {
      fixedExpenses += amount;
    } else {
      // VARIABLE or null — an unclassified OUTFLOW category is treated as
      // Variable so its spend never silently vanishes from the waterfall.
      variableExpenses += amount;
    }
  }
  const savings = income - fixedExpenses - variableExpenses;

  // --- deltaVsPreviousMonth ---
  const prevOutflowEntries = prevActiveEntries.filter((e) => categoryById.get(e.categoryId)?.type === "OUTFLOW");
  const prevSpendByCategory = new Map<string, number>();
  for (const e of prevOutflowEntries) {
    prevSpendByCategory.set(e.categoryId, (prevSpendByCategory.get(e.categoryId) ?? 0) + actualFor(e));
  }
  const prevTotalSpend = [...prevSpendByCategory.values()].reduce((sum, v) => sum + v, 0);
  const totalSpendChange = totalSpend - prevTotalSpend;
  const totalSpendChangePercent = prevTotalSpend === 0 ? 0 : totalSpendChange / prevTotalSpend;

  const moverCategoryIds = new Set([...spendByCategory.keys(), ...prevSpendByCategory.keys()]);
  const topMovers = [...moverCategoryIds]
    .map((categoryId) => ({
      categoryId,
      name: nameFor(categoryId),
      change: (spendByCategory.get(categoryId) ?? 0) - (prevSpendByCategory.get(categoryId) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 3);

  // --- subscriptions ---
  const subscriptionCategoryIds = new Set(categories.filter((c) => c.isSubscription).map((c) => c.id));
  let subscriptionsTotal = 0;
  let hasPriceHike = false;
  for (const [categoryId, t] of varianceTotals) {
    if (!subscriptionCategoryIds.has(categoryId)) continue;
    subscriptionsTotal += t.actualTotal;
    if (t.actualTotal > t.baseTotal) hasPriceHike = true;
  }

  // --- unpaid: raw list, not the fallback-to-planned total ---
  const unpaid = entries
    .filter((e) => isEntryUnpaid({ actualAmount: e.actualAmount?.toString() ?? null, isSkipped: e.isSkipped }))
    .map((e) => ({
      categoryId: e.categoryId,
      categoryName: nameFor(e.categoryId),
      entryName: e.name,
      plannedAmount: Number(e.plannedAmount),
      dueStatus: (opts.periodKind === "previous" ? "overdue" : "current") as "current" | "overdue",
    }));

  return {
    categoryBreakup,
    totalSpend,
    variance,
    waterfall: { income, fixedExpenses, variableExpenses, savings },
    deltaVsPreviousMonth: { totalSpendChange, totalSpendChangePercent, topMovers },
    subscriptions: { total: subscriptionsTotal, hasPriceHike },
    unpaid,
  };
}
