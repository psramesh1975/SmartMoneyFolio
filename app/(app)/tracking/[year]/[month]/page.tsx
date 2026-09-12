import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getHouseholdTimeZone } from "@/lib/monthly-data";
import { getCurrentPeriod, getPreviousPeriod, getNextPeriod, MONTH_LABELS } from "@/lib/monthly-periods";
import { getForwardSimulationPayload, isFutureDraftPeriod } from "@/lib/tracking-data";
import ForwardSimulationClient from "@/components/tracking/ForwardSimulationClient";

// /tracking/[year]/[month] — the dynamic Forward Simulation route, per
// FutureMonthsSection.tsx's href convention (e.g. "/tracking/2026/november":
// month is the lowercase full month name, not a number). Only ever serves
// draft months strictly beyond Next Month — Current/Previous/Next/Earlier
// already have their own dedicated pages and edit semantics, so any request
// for one of those periods here redirects to the real page instead of
// duplicating it.
export default async function ForwardSimulationRoute({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year: yearParam, month: monthParam } = await params;

  const year = Number(yearParam);
  const monthIndex = MONTH_LABELS.findIndex((m) => m.toLowerCase() === monthParam.toLowerCase());
  if (!Number.isInteger(year) || monthIndex === -1) notFound();
  const month = monthIndex + 1;

  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const timeZone = await getHouseholdTimeZone(session.householdId);
  const period = { year, month };

  const current = getCurrentPeriod(timeZone);
  const previous = getPreviousPeriod(timeZone);
  const next = getNextPeriod(timeZone);
  if (period.year === current.year && period.month === current.month) redirect("/monthly/current");
  if (period.year === previous.year && period.month === previous.month) redirect("/monthly/previous");
  if (period.year === next.year && period.month === next.month) redirect("/monthly/next");

  if (!(await isFutureDraftPeriod(period, timeZone))) {
    // Anything else that isn't strictly beyond Next Month is in the past —
    // Forward Simulation doesn't cover history.
    redirect("/monthly/next");
  }

  const payload = await getForwardSimulationPayload(session.householdId, year, month);

  return (
    <ForwardSimulationClient
      year={year}
      month={month}
      monthLabel={payload.monthLabel}
      projectedInflow={payload.projectedInflow}
      committedBaseAndSips={payload.committedBaseAndSips}
      advanceEntriesTotal={payload.advanceEntriesTotal}
      advanceEntriesCount={payload.advanceEntriesCount}
      rows={payload.rows}
      categoryOptions={payload.categoryOptions}
    />
  );
}
