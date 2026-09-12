import { prisma } from "@/lib/db";
import { getHouseholdTimeZone } from "@/lib/monthly-data";
import { computeMonthlySummary, type MonthlySummaryInput } from "@/lib/monthly-summary";
import { getCurrentPeriod, getPreviousPeriod, MONTH_LABELS, type Period } from "@/lib/monthly-periods";

export type DashboardCashFlow = {
  currentMonthLabel: string; // e.g. "March 2026"
  monthlyInflow: number; // actualIncome, current month
  monthlyOutflow: number; // actualOutflow, current month
  avgMonthlyOutflow: number | null; // null if no completed-month history exists yet
};

// Walks back 3 completed calendar months from Previous Month (deliberately
// not anchored to "today" beyond that first step) — used for the burn-rate
// average, which excludes the still-in-progress Current Month on purpose.
function lastThreeCompletedMonths(timeZone: string): Period[] {
  const months: Period[] = [];
  let { year, month } = getPreviousPeriod(timeZone);
  for (let i = 0; i < 3; i++) {
    months.push({ year, month });
    if (month === 1) {
      year -= 1;
      month = 12;
    } else {
      month -= 1;
    }
  }
  return months;
}

function toSummaryInput(
  e: { categoryId: string; plannedAmount: { toString(): string }; actualAmount: { toString(): string } | null; isSkipped: boolean },
  categoryType: Map<string, "INCOME" | "OUTFLOW">
): MonthlySummaryInput {
  return {
    categoryType: categoryType.get(e.categoryId) ?? "OUTFLOW",
    plannedAmount: e.plannedAmount.toString(),
    actualAmount: e.actualAmount?.toString() ?? null,
    isSkipped: e.isSkipped,
  };
}

// PERF-01: previously called getMonthPayload() for the current month, which
// (correctly, for the actual Current Month *page*) calls
// reconcileAutoLinkedLineItems() and ensureMonthGenerated() before reading
// anything — write/reconcile work the dashboard has no business triggering
// on every single visit. The dashboard only needs aggregated trailing
// numbers, so this reads whatever Monthly Tracking entries already exist for
// the current + 3 trailing completed months (one combined query, covering
// all 4 periods with a single OR list, alongside the category-type lookup in
// one Promise.all) and never writes anything.
//
// Also split out (see computeLiquidBuffer's comment) so
// getDashboardHeadlineKPIs() can pass in an already-fetched timeZone instead
// of this function re-fetching the household itself.
//
// Trade-off this accepts: if the current calendar month has never been
// generated yet for this household (nobody has opened /monthly/current, and
// no linked EMI/SIP has been reconciled this month), monthlyInflow/
// monthlyOutflow will read as 0 here until that happens on its own accord —
// where previously a dashboard visit would have silently generated it as a
// side effect. That's the intended behavior per PERF-01: generation is
// /monthly/current's job, not a side effect of viewing read-only KPIs.
// Historical completed-month figures (avgMonthlyOutflow) are unaffected
// either way, since those months are already finalized.
async function computeDashboardCashFlow(householdId: string, timeZone: string): Promise<DashboardCashFlow> {
  const { year, month } = getCurrentPeriod(timeZone);
  const trailingMonths = lastThreeCompletedMonths(timeZone);
  const allPeriods: Period[] = [{ year, month }, ...trailingMonths];

  const [categories, entries] = await Promise.all([
    prisma.monthlyCategory.findMany({
      where: { householdId },
      select: { id: true, type: true },
    }),
    prisma.monthlyEntry.findMany({
      where: { householdId, OR: allPeriods.map((p) => ({ year: p.year, month: p.month })) },
      select: {
        categoryId: true,
        year: true,
        month: true,
        plannedAmount: true,
        actualAmount: true,
        isSkipped: true,
      },
    }),
  ]);

  const categoryType = new Map(categories.map((c) => [c.id, c.type] as const));
  const entriesFor = (p: Period) => entries.filter((e) => e.year === p.year && e.month === p.month);

  const currentSummary = computeMonthlySummary(
    entriesFor({ year, month }).map((e) => toSummaryInput(e, categoryType))
  );

  const completedMonthOutflows: number[] = [];
  for (const p of trailingMonths) {
    const monthEntries = entriesFor(p);
    if (monthEntries.length === 0) continue; // no Monthly Tracking history for this month
    const summary = computeMonthlySummary(monthEntries.map((e) => toSummaryInput(e, categoryType)));
    completedMonthOutflows.push(summary.actualOutflow);
  }

  const avgMonthlyOutflow =
    completedMonthOutflows.length > 0
      ? completedMonthOutflows.reduce((sum, v) => sum + v, 0) / completedMonthOutflows.length
      : null;

  return {
    currentMonthLabel: `${MONTH_LABELS[month - 1]} ${year}`,
    monthlyInflow: currentSummary.actualIncome,
    monthlyOutflow: currentSummary.actualOutflow,
    avgMonthlyOutflow,
  };
}

export async function getDashboardCashFlow(householdId: string): Promise<DashboardCashFlow> {
  const timeZone = await getHouseholdTimeZone(householdId);
  return computeDashboardCashFlow(householdId, timeZone);
}

// "Liquid" here is a product decision baked into this phase, not a schema
// flag: Cash + Fixed Deposits, in the household's base currency only (same
// no-FX-conversion convention as net worth/allocation elsewhere).
const LIQUID_ASSET_CLASSES = ["CASH", "FIXED_DEPOSIT"] as const;

// Split out so getDashboardHeadlineKPIs() can share one household lookup
// across all three branches instead of each of getLiquidBuffer(),
// getSolvencySnapshot(), and getDashboardCashFlow() independently re-fetching
// it (PERF-01) — every concurrent query still needing its own connection
// against this DB, redundant household round trips were pure waste. The
// public getLiquidBuffer() below is unchanged for other callers.
async function computeLiquidBuffer(householdId: string, baseCurrency: string): Promise<{ liquidBuffer: number }> {
  const accounts = await prisma.account.findMany({
    where: {
      householdId,
      currency: baseCurrency,
      assetClass: { in: [...LIQUID_ASSET_CLASSES] },
    },
    select: { currentValue: true },
  });

  const liquidBuffer = accounts.reduce((sum, a) => sum + Number(a.currentValue), 0);
  return { liquidBuffer };
}

export async function getLiquidBuffer(householdId: string): Promise<{ liquidBuffer: number }> {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { baseCurrency: true },
  });
  if (!household) return { liquidBuffer: 0 };

  return computeLiquidBuffer(householdId, household.baseCurrency);
}

// Color-band for a debt-to-asset ratio — shared by the dashboard's solvency
// card and /liabilities' Debt-to-Asset Health KPI, so the two surfaces never
// drift into disagreeing about what counts as "healthy" vs "risky".
export function ratioTone(ratio: number) {
  if (ratio < 20) return "text-emerald-600 dark:text-cyan-400";
  if (ratio < 40) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export type SolvencySnapshot = {
  baseCurrency: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  debtToAssetRatio: number; // percent, 0 if totalAssets is 0
};

// See computeLiquidBuffer's comment — same household-fetch-sharing reason.
// `familyMemberId` is optional and additive (added for the dashboard's
// per-member filter): omitted, this is the existing household-wide snapshot
// every other caller (getDebtSnapshot, etc.) already relies on.
async function computeSolvencySnapshot(
  householdId: string,
  baseCurrency: string,
  familyMemberId?: string
): Promise<SolvencySnapshot> {
  const [accounts, liabilities] = await Promise.all([
    prisma.account.findMany({
      where: { householdId, currency: baseCurrency, ...(familyMemberId ? { familyMemberId } : {}) },
      select: { currentValue: true },
    }),
    prisma.liability.findMany({
      where: { householdId, currency: baseCurrency, ...(familyMemberId ? { familyMemberId } : {}) },
      select: { outstandingBalance: true },
    }),
  ]);

  const totalAssets = accounts.reduce((sum, a) => sum + Number(a.currentValue), 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + Number(l.outstandingBalance), 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  return { baseCurrency, totalAssets, totalLiabilities, netWorth, debtToAssetRatio };
}

// Base-currency-only, same no-FX-conversion convention as everywhere else —
// other-currency accounts/liabilities are listed separately, not netted in.
export async function getSolvencySnapshot(householdId: string, familyMemberId?: string): Promise<SolvencySnapshot> {
  const household = await prisma.household.findUnique({ where: { id: householdId }, select: { baseCurrency: true } });
  const base = household?.baseCurrency ?? "USD";

  return computeSolvencySnapshot(householdId, base, familyMemberId);
}

export type DebtSnapshot = {
  baseCurrency: string;
  totalOutstandingPrincipal: number; // sum(outstandingBalance), base-currency liabilities only
  activeLiabilityCount: number;
  monthlyDebtService: number; // sum(emiAmount) where set, base-currency only
  blendedInterestRate: number | null; // weighted avg APR over amortizing liabilities only; null if none
  debtToAssetRatio: number; // reused from getSolvencySnapshot, not recomputed
};

// Powers the 4 KPI cards at the top of /liabilities. Reuses
// getSolvencySnapshot() for the Debt-to-Asset figure rather than re-querying
// assets a second way — that ratio needs to agree everywhere it's shown.
export async function getDebtSnapshot(householdId: string): Promise<DebtSnapshot> {
  const [solvency, liabilities] = await Promise.all([
    getSolvencySnapshot(householdId),
    prisma.liability.findMany({
      where: { householdId },
      select: { currency: true, outstandingBalance: true, emiAmount: true, interestRate: true },
    }),
  ]);

  const baseCurrency = solvency.baseCurrency;
  const baseRows = liabilities.filter((l) => l.currency === baseCurrency);

  const totalOutstandingPrincipal = baseRows.reduce((sum, l) => sum + Number(l.outstandingBalance), 0);
  const monthlyDebtService = baseRows
    .filter((l) => l.emiAmount != null)
    .reduce((sum, l) => sum + Number(l.emiAmount), 0);

  // Non-amortizing liabilities (credit cards, 0% device EMIs — null/0
  // interestRate) are excluded from the blended rate: including them would
  // drag a "blended APR" figure toward zero in a way that misrepresents what
  // you're actually paying interest on. Their balances still count fully in
  // totalOutstandingPrincipal above.
  const amortizingRows = baseRows.filter((l) => l.interestRate != null && Number(l.interestRate) > 0);
  const amortizingBalance = amortizingRows.reduce((sum, l) => sum + Number(l.outstandingBalance), 0);
  const blendedInterestRate =
    amortizingBalance > 0
      ? amortizingRows.reduce((sum, l) => sum + Number(l.outstandingBalance) * Number(l.interestRate), 0) / amortizingBalance
      : null;

  return {
    baseCurrency,
    totalOutstandingPrincipal,
    activeLiabilityCount: baseRows.length,
    monthlyDebtService,
    blendedInterestRate,
    debtToAssetRatio: solvency.debtToAssetRatio,
  };
}

export type DashboardHeadlineKPIs = {
  baseCurrency: string;
  liquidBuffer: number;
  netCashFlow: number; // current month actualIncome - actualOutflow
  financialRunway: number | null; // months, 1 decimal; null if no 3-month outflow history yet
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  debtToAssetRatio: number;
  // True when totalAssets/totalLiabilities/netWorth/debtToAssetRatio above
  // are scoped to one family member rather than the whole household — see
  // the `familyMemberId` param below. netCashFlow/financialRunway/
  // liquidBuffer are NEVER member-scoped: Monthly Tracking entries
  // (lib/dashboard-data.ts's MonthlyEntry/MonthlyCategory) have no
  // familyMemberId in the schema, so cash flow and the runway derived from
  // it are inherently household-wide figures. Callers should caption those
  // two as "household-wide" whenever isMemberFiltered is true, rather than
  // implying they narrowed down with the rest of the row.
  isMemberFiltered: boolean;
};

// Combines getLiquidBuffer() and getDashboardCashFlow() (previously written
// but never wired into any component) with getSolvencySnapshot() into the
// single payload the Phase 8 dashboard headline row needs. Financial Runway
// is liquidBuffer ÷ avgMonthlyOutflow — null (not 0 or Infinity) when there's
// no completed-month history yet, so the UI can render "Not enough history"
// instead of a misleading number.
//
// PERF-01: fetches the household once (baseCurrency + timeZone together)
// and calls the three compute*() helpers directly instead of Promise.all-ing
// getSolvencySnapshot()/getLiquidBuffer()/getDashboardCashFlow() themselves —
// each of those, called standalone, does its own household round trip first.
// Concurrent though those three household lookups were, each still needed
// its own connection against this DB, so cutting three down to one measurably
// helps. getSolvencySnapshot()/getLiquidBuffer()/getDashboardCashFlow()
// remain as they were for every other caller (e.g. getDebtSnapshot()).
export async function getDashboardHeadlineKPIs(
  householdId: string,
  familyMemberId?: string
): Promise<DashboardHeadlineKPIs> {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { baseCurrency: true, timeZone: true },
  });
  const baseCurrency = household?.baseCurrency ?? "USD";
  const timeZone = household?.timeZone || "UTC";

  // liquidBuffer/cashFlow are always computed household-wide — see
  // DashboardHeadlineKPIs.isMemberFiltered's comment for why.
  const [solvency, liquid, cashFlow] = await Promise.all([
    computeSolvencySnapshot(householdId, baseCurrency, familyMemberId),
    computeLiquidBuffer(householdId, baseCurrency),
    computeDashboardCashFlow(householdId, timeZone),
  ]);

  const netCashFlow = cashFlow.monthlyInflow - cashFlow.monthlyOutflow;

  const financialRunway =
    cashFlow.avgMonthlyOutflow && cashFlow.avgMonthlyOutflow > 0
      ? Math.round((liquid.liquidBuffer / cashFlow.avgMonthlyOutflow) * 10) / 10
      : null;

  return {
    baseCurrency: solvency.baseCurrency,
    liquidBuffer: liquid.liquidBuffer,
    netCashFlow,
    financialRunway,
    totalAssets: solvency.totalAssets,
    totalLiabilities: solvency.totalLiabilities,
    netWorth: solvency.netWorth,
    debtToAssetRatio: solvency.debtToAssetRatio,
    isMemberFiltered: Boolean(familyMemberId),
  };
}

// Current-month label for the "Upcoming Debits (Sep 2026)"-style header —
// split out from computeDashboardCashFlow() (which already derives the same
// value internally) so page.tsx can show it without pulling in the whole
// cash-flow computation just for a label.
export async function getCurrentMonthLabel(householdId: string): Promise<string> {
  const timeZone = await getHouseholdTimeZone(householdId);
  const { year, month } = getCurrentPeriod(timeZone);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export type GoalPacing = {
  monthsRemaining: number | null; // null if no targetDate set
  requiredMonthlyRate: number | null; // null if no targetDate, or if already at/past target
  isOverdue: boolean; // targetDate in the past and target not yet reached
};

export function getGoalPacing(
  goal: { targetAmount: number; currentAmount: number; targetDate: Date | null },
  now: Date = new Date()
): GoalPacing {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (!goal.targetDate) return { monthsRemaining: null, requiredMonthlyRate: null, isOverdue: false };

  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44;
  const monthsRemaining = (goal.targetDate.getTime() - now.getTime()) / msPerMonth;

  if (remaining <= 0) return { monthsRemaining: Math.max(0, Math.round(monthsRemaining)), requiredMonthlyRate: 0, isOverdue: false };
  if (monthsRemaining <= 0) return { monthsRemaining: 0, requiredMonthlyRate: null, isOverdue: true };

  return {
    monthsRemaining: Math.round(monthsRemaining),
    requiredMonthlyRate: remaining / monthsRemaining,
    isOverdue: false,
  };
}

export type UpcomingAutoDebit = {
  id: string;
  title: string;
  amount: number;
  dueDay: number; // day-of-month (1-31), not "days from now" — see nextOccurrenceWithinWindow
  dueDate: string; // ISO date (UTC midnight) of the actual upcoming occurrence — lets the UI
                    // compute "due in N days" and format "15 Sep" without re-deriving month
                    // wraparound itself (dueDay alone can't tell you which month it falls in)
  type: "EMI" | "SIP";
  memberName?: string;
  familyMemberId: string;
};

function getHouseholdTodayYMD(timeZone: string): { year: number; month: number; day: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// A fixed monthly due day can fall due in the current month or, once the
// window crosses a month boundary, the next one — this checks both and
// returns whichever occurrence (if either) lands inside
// [todayMs, windowEndMs], as a UTC-midnight timestamp for sorting. A due day
// past a short month's end clamps to that month's last day (day 31 in a
// 30-day month), the usual recurring-billing convention.
function nextOccurrenceWithinWindow(
  dueDay: number,
  today: { year: number; month: number },
  todayMs: number,
  windowEndMs: number
): number | null {
  for (const offset of [0, 1]) {
    let year = today.year;
    let month = today.month + offset;
    if (month > 12) {
      month -= 12;
      year += 1;
    }
    const clampedDay = Math.min(dueDay, daysInMonth(year, month));
    const occurrenceMs = Date.UTC(year, month - 1, clampedDay);
    if (occurrenceMs >= todayMs && occurrenceMs <= windowEndMs) return occurrenceMs;
  }
  return null;
}

// Powers the dashboard's "Upcoming Debits" card: active EMIs and SIPs whose
// due day falls within the next `daysAhead` days. Only liabilities/accounts
// with an explicitly-set emiDueDay/sipDueDay are considered — there's no
// edit UI for those fields yet, so most existing rows simply won't appear
// here until a real due day is recorded. Never fabricates a date (e.g. from
// createdAt) to fill the gap.
export async function getUpcomingAutoDebits(
  householdId: string,
  daysAhead = 15,
  familyMemberId?: string
): Promise<UpcomingAutoDebit[]> {
  const timeZone = await getHouseholdTimeZone(householdId);
  const today = getHouseholdTodayYMD(timeZone);
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  const windowEndMs = todayMs + daysAhead * 24 * 60 * 60 * 1000;
  const memberFilter = familyMemberId ? { familyMemberId } : {};

  const [liabilities, accounts] = await Promise.all([
    prisma.liability.findMany({
      where: { householdId, emiDueDay: { not: null }, emiAmount: { not: null }, ...memberFilter },
      select: {
        id: true,
        name: true,
        emiAmount: true,
        emiDueDay: true,
        familyMemberId: true,
        familyMember: { select: { name: true } },
      },
    }),
    prisma.account.findMany({
      where: {
        householdId,
        assetClass: "MUTUAL_FUNDS",
        sipDueDay: { not: null },
        sipMonthlyAmount: { not: null },
        ...memberFilter,
      },
      select: {
        id: true,
        holdingName: true,
        sipMonthlyAmount: true,
        sipDueDay: true,
        familyMemberId: true,
        familyMember: { select: { name: true } },
      },
    }),
  ]);

  const debits: (UpcomingAutoDebit & { occurrenceMs: number })[] = [];

  for (const l of liabilities) {
    const amount = Number(l.emiAmount);
    if (!(amount > 0) || l.emiDueDay == null) continue;
    const occurrenceMs = nextOccurrenceWithinWindow(l.emiDueDay, today, todayMs, windowEndMs);
    if (occurrenceMs === null) continue;
    debits.push({
      id: l.id,
      title: l.name,
      amount,
      dueDay: l.emiDueDay,
      dueDate: new Date(occurrenceMs).toISOString(),
      type: "EMI",
      memberName: l.familyMember.name,
      familyMemberId: l.familyMemberId,
      occurrenceMs,
    });
  }

  for (const a of accounts) {
    const amount = Number(a.sipMonthlyAmount);
    if (!(amount > 0) || a.sipDueDay == null) continue;
    const occurrenceMs = nextOccurrenceWithinWindow(a.sipDueDay, today, todayMs, windowEndMs);
    if (occurrenceMs === null) continue;
    debits.push({
      id: a.id,
      title: a.holdingName,
      amount,
      dueDay: a.sipDueDay,
      dueDate: new Date(occurrenceMs).toISOString(),
      type: "SIP",
      memberName: a.familyMember.name,
      familyMemberId: a.familyMemberId,
      occurrenceMs,
    });
  }

  debits.sort((a, b) => a.occurrenceMs - b.occurrenceMs);
  return debits.map(({ occurrenceMs: _occurrenceMs, ...rest }) => rest);
}

export type PrimaryGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: Date | null;
};

// Picks the dashboard's featured goal: the household's active goal with the
// largest target amount, on the assumption a "corpus"/retirement-style goal
// is usually the biggest one. The Goal model has no explicit "primary" flag
// (confirmed with the user before choosing this heuristic over adding one).
export async function getPrimaryGoal(householdId: string): Promise<PrimaryGoal | null> {
  const goal = await prisma.goal.findFirst({
    where: { householdId },
    orderBy: { targetAmount: "desc" },
  });
  if (!goal) return null;

  return {
    id: goal.id,
    name: goal.name,
    targetAmount: Number(goal.targetAmount),
    currentAmount: Number(goal.currentAmount),
    currency: goal.currency,
    targetDate: goal.targetDate,
  };
}

// "Current pace" for the Goal Velocity card's projected-completion line —
// the household's total active SIP commitment (base-currency Mutual Fund
// accounts only, same qualifying filter as reconcileAutoLinkedLineItems()).
// The schema doesn't scope a SIP to a specific goal, so this is a
// household-wide aggregate used as the closest honest proxy for "money
// currently flowing toward goals" rather than inventing a per-goal
// contribution figure that doesn't exist anywhere in the data model.
// Real freshness signal for the dashboard header's "Last updated" line —
// the most recent price sync across the whole securities catalog (global,
// not household-scoped; see SecuritiesMaster's comment). Null until the
// price-sync cron (app/api/cron/sync-prices) has ever run.
export async function getLatestPriceSyncAt(): Promise<Date | null> {
  const result = await prisma.securitiesMaster.aggregate({
    _max: { priceUpdatedAt: true },
  });
  return result._max.priceUpdatedAt ?? null;
}

export async function getMonthlySipTotal(householdId: string): Promise<number> {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { baseCurrency: true },
  });
  if (!household) return 0;

  const accounts = await prisma.account.findMany({
    where: {
      householdId,
      currency: household.baseCurrency,
      assetClass: "MUTUAL_FUNDS",
      sipMonthlyAmount: { not: null },
    },
    select: { sipMonthlyAmount: true },
  });

  return accounts.reduce((sum, a) => sum + Number(a.sipMonthlyAmount), 0);
}
