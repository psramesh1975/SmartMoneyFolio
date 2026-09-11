import { prisma } from "@/lib/db";
import { getHouseholdTimeZone, getMonthPayload } from "@/lib/monthly-data";
import { computeMonthlySummary } from "@/lib/monthly-summary";
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

export async function getDashboardCashFlow(householdId: string): Promise<DashboardCashFlow> {
  const timeZone = await getHouseholdTimeZone(householdId);
  const { year, month } = getCurrentPeriod(timeZone);

  // Reuses getMonthPayload directly (same call the Current Month page makes)
  // rather than re-deriving the query — this also means ensureMonthGenerated
  // runs here too, the same side effect that already happens on every visit
  // to /monthly/current. Not new behavior, just now also triggered by the
  // dashboard if it's opened first.
  const currentPayload = await getMonthPayload(householdId, year, month);

  const months = lastThreeCompletedMonths(timeZone);

  // One batched query across the whole 3-month range (which may cross a
  // calendar-year boundary in Jan/Feb, unlike getYearPayload's single-year
  // window) rather than one query per month.
  const [categories, entries] = await Promise.all([
    prisma.monthlyCategory.findMany({
      where: { householdId },
      select: { id: true, type: true },
    }),
    prisma.monthlyEntry.findMany({
      where: { householdId, OR: months.map((p) => ({ year: p.year, month: p.month })) },
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

  const completedMonthOutflows: number[] = [];
  for (const p of months) {
    const monthEntries = entries.filter((e) => e.year === p.year && e.month === p.month);
    if (monthEntries.length === 0) continue; // no Monthly Tracking history for this month
    const summary = computeMonthlySummary(
      monthEntries.map((e) => ({
        categoryType: categoryType.get(e.categoryId) ?? "OUTFLOW",
        plannedAmount: e.plannedAmount.toString(),
        actualAmount: e.actualAmount?.toString() ?? null,
        isSkipped: e.isSkipped,
      }))
    );
    completedMonthOutflows.push(summary.actualOutflow);
  }

  const avgMonthlyOutflow =
    completedMonthOutflows.length > 0
      ? completedMonthOutflows.reduce((sum, v) => sum + v, 0) / completedMonthOutflows.length
      : null;

  return {
    currentMonthLabel: `${MONTH_LABELS[month - 1]} ${year}`,
    monthlyInflow: currentPayload.summary.actualIncome,
    monthlyOutflow: currentPayload.summary.actualOutflow,
    avgMonthlyOutflow,
  };
}

// "Liquid" here is a product decision baked into this phase, not a schema
// flag: Cash + Fixed Deposits, in the household's base currency only (same
// no-FX-conversion convention as net worth/allocation elsewhere).
const LIQUID_ASSET_CLASSES = ["CASH", "FIXED_DEPOSIT"] as const;

export async function getLiquidBuffer(householdId: string): Promise<{ liquidBuffer: number }> {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { baseCurrency: true },
  });
  if (!household) return { liquidBuffer: 0 };

  const accounts = await prisma.account.findMany({
    where: {
      householdId,
      currency: household.baseCurrency,
      assetClass: { in: [...LIQUID_ASSET_CLASSES] },
    },
    select: { currentValue: true },
  });

  const liquidBuffer = accounts.reduce((sum, a) => sum + Number(a.currentValue), 0);
  return { liquidBuffer };
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

// Base-currency-only, same no-FX-conversion convention as everywhere else —
// other-currency accounts/liabilities are listed separately, not netted in.
export async function getSolvencySnapshot(householdId: string): Promise<SolvencySnapshot> {
  const household = await prisma.household.findUnique({ where: { id: householdId }, select: { baseCurrency: true } });
  const base = household?.baseCurrency ?? "USD";

  const [accounts, liabilities] = await Promise.all([
    prisma.account.findMany({ where: { householdId, currency: base }, select: { currentValue: true } }),
    prisma.liability.findMany({ where: { householdId, currency: base }, select: { outstandingBalance: true } }),
  ]);

  const totalAssets = accounts.reduce((sum, a) => sum + Number(a.currentValue), 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + Number(l.outstandingBalance), 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  return { baseCurrency: base, totalAssets, totalLiabilities, netWorth, debtToAssetRatio };
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
