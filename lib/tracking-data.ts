// Data layer for the Forward Simulation feature ("Future Months" /
// /tracking/[year]/[month]): draft months beyond Next Month that a household
// can initialize to sanity-check cash flow before it's real. Reuses the same
// generation machinery as Current/Previous/Next (getMonthPayload,
// ensureMonthGenerated) — a draft month is not a distinct data model, just an
// ordinary MonthlyEntry set for a period further out than "Next Month".
// Nothing here ever touches actualAmount, principalAppliedAmount, or
// sipUnitsApplied — those only change via app/api/monthly/entries/[id]
// (PATCH), which this feature's UI never calls, so draft months can never
// reconcile against real liability/account balances.

import { prisma } from "@/lib/db";
import { getMonthPayload, getHouseholdTimeZone } from "@/lib/monthly-data";
import { getNextPeriod, MONTH_LABELS, type Period } from "@/lib/monthly-periods";
import { DEBT_CATEGORY_NAME, SIP_CATEGORY_NAME } from "@/lib/monthly-auto-sync";
import type { MonthlyCategoryOptionDTO } from "@/lib/monthly-types";

export type SourceType = "Monthly Base EMI" | "Monthly Base SIP" | "Monthly Base General" | "Advance Entry";
export type ExecutionStatus = "Auto-Prepopulated" | "Simulated Outflow";

export type CommitmentRow = {
  name: string;
  note?: string;
  sourceType: SourceType;
  scheduleDate: string;
  amount: number;
  status: ExecutionStatus;
};

export type ForwardSimulationPayload = {
  monthLabel: string;
  projectedInflow: number;
  committedBaseAndSips: number;
  advanceEntriesTotal: number;
  advanceEntriesCount: number;
  rows: CommitmentRow[];
  // For the "Log Advance Expense" modal's category picker — general OUTFLOW
  // categories only, same exclusion as Monthly Base's own "+ Add" picker
  // (lib/monthly-data.ts's getFlatBasePayload): the two auto-linked system
  // categories aren't valid targets for a manually logged expense.
  categoryOptions: MonthlyCategoryOptionDTO[];
};

function periodRank(p: Period): number {
  return p.year * 12 + p.month;
}

// A "draft month" is anything strictly later than Next Month — Current/
// Previous/Next already have their own dedicated pages, and Earlier Months/
// Years cover the past, so Forward Simulation only ever owns the open range
// beyond Next Month.
export async function isFutureDraftPeriod(period: Period, timeZone: string): Promise<boolean> {
  const next = getNextPeriod(timeZone);
  return periodRank(period) > periodRank(next);
}

// Cap how far out "Add Another Month" will initialize — prevents a
// mis-clicked year turning into a garbage row 40 years out. Generous enough
// (2 years past Next Month) for genuine forward planning.
export const MAX_DRAFT_MONTHS_AHEAD = 24;

export function isWithinDraftRange(period: Period, timeZone: string, next: Period): boolean {
  const rank = periodRank(period);
  return rank > periodRank(next) && rank <= periodRank(next) + MAX_DRAFT_MONTHS_AHEAD;
}

export type DraftMonthEntry = { year: number; month: number; label: string };

// Every distinct (year, month) beyond Next Month that already has at least
// one MonthlyEntry — i.e. every draft the household has actually initialized
// (via the sidebar's "Add Another Month" or by visiting /tracking directly),
// not every theoretically-reachable future month.
export async function getDraftMonths(householdId: string, timeZone: string): Promise<DraftMonthEntry[]> {
  const next = getNextPeriod(timeZone);
  const distinctPeriods = await prisma.monthlyEntry.findMany({
    where: { householdId },
    distinct: ["year", "month"],
    select: { year: true, month: true },
  });

  return distinctPeriods
    .filter((p) => periodRank(p) > periodRank(next))
    .sort((a, b) => periodRank(a) - periodRank(b))
    .map((p) => ({ year: p.year, month: p.month, label: `${MONTH_LABELS[p.month - 1]} ${p.year}` }));
}

// Same clamp-to-month-end convention as the dashboard's upcoming-debits
// nextOccurrenceWithinWindow — a due day past a short month's end (e.g. day
// 31 in a 30-day month) clamps to that month's last day.
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const SCHEDULE_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function formatScheduleDate(year: number, month: number, day: number): string {
  const clamped = Math.min(day, daysInMonth(year, month));
  return SCHEDULE_DATE_FORMAT.format(new Date(Date.UTC(year, month - 1, clamped)));
}

// Initializes (if needed — idempotent, same as visiting Current/Next) and
// reads back a draft month's Forward Simulation view. Callers must check
// isFutureDraftPeriod()/isWithinDraftRange() themselves before calling this —
// it does not re-validate the period, matching getMonthPayload's own
// "generate whatever period you ask for" contract.
export async function getForwardSimulationPayload(
  householdId: string,
  year: number,
  month: number
): Promise<ForwardSimulationPayload> {
  const payload = await getMonthPayload(householdId, year, month);

  // getMonthPayload's own query only includes `lineItem: true` — Forward
  // Simulation additionally needs the linked liability's/account's due-day
  // to show a real schedule date, so this re-fetches entries with the
  // richer include rather than widening the shared function's query (used
  // by Current/Next/the API route) for a need only this feature has.
  const entries = await prisma.monthlyEntry.findMany({
    where: { householdId, year, month, isSkipped: false },
    include: {
      category: true,
      lineItem: { include: { liability: true, account: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: CommitmentRow[] = entries
    .filter((e) => e.category.type === "OUTFLOW")
    .map((e) => {
      const amount = Number(e.plannedAmount);

      if (e.lineItemId && e.lineItem) {
        const sourceType: SourceType =
          e.category.name === DEBT_CATEGORY_NAME
            ? "Monthly Base EMI"
            : e.category.name === SIP_CATEGORY_NAME
              ? "Monthly Base SIP"
              : "Monthly Base General";
        const dueDay = e.lineItem.liability?.emiDueDay ?? e.lineItem.account?.sipDueDay ?? null;
        return {
          name: e.name,
          sourceType,
          scheduleDate: dueDay ? formatScheduleDate(year, month, dueDay) : "Recurring",
          amount,
          status: "Auto-Prepopulated" as const,
        };
      }

      return {
        name: e.name,
        note: e.notes ?? undefined,
        sourceType: "Advance Entry" as const,
        scheduleDate: e.scheduledDay ? formatScheduleDate(year, month, e.scheduledDay) : "As logged",
        amount,
        status: "Simulated Outflow" as const,
      };
    });

  const committedBaseAndSips = rows.filter((r) => r.sourceType !== "Advance Entry").reduce((s, r) => s + r.amount, 0);
  const advanceRows = rows.filter((r) => r.sourceType === "Advance Entry");
  const advanceEntriesTotal = advanceRows.reduce((s, r) => s + r.amount, 0);

  const categoryOptions: MonthlyCategoryOptionDTO[] = payload.categories
    .filter((c) => c.type === "OUTFLOW" && c.name !== DEBT_CATEGORY_NAME && c.name !== SIP_CATEGORY_NAME)
    .map((c) => ({ id: c.id, name: c.name, type: c.type, spendKind: c.spendKind, isSubscription: c.isSubscription }));

  return {
    monthLabel: `${MONTH_LABELS[month - 1]} ${year}`,
    projectedInflow: payload.summary.plannedIncome,
    committedBaseAndSips,
    advanceEntriesTotal,
    advanceEntriesCount: advanceRows.length,
    rows,
    categoryOptions,
  };
}

// "Reset to Base": wipes every entry this draft month has (both auto-linked
// and advance) and regenerates purely from the CURRENT Monthly Base
// blueprint — simpler and more correct than trying to revert individual
// edited fields, and it also picks up any Base changes made since the draft
// was first initialized. Real bank balances/liabilities are never touched:
// this only ever deletes/creates MonthlyEntry rows.
export async function resetDraftMonthToBase(householdId: string, year: number, month: number): Promise<void> {
  await prisma.monthlyEntry.deleteMany({ where: { householdId, year, month } });
  await getMonthPayload(householdId, year, month);
}

export async function getDraftMonthValidation(
  householdId: string,
  year: number,
  month: number
): Promise<{ valid: boolean; timeZone: string; next: Period }> {
  const timeZone = await getHouseholdTimeZone(householdId);
  const next = getNextPeriod(timeZone);
  return { valid: periodRank({ year, month }) > periodRank(next), timeZone, next };
}
