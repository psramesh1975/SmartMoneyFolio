import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHouseholdTimeZone } from "@/lib/monthly-data";
import { isFutureDraftPeriod, resetDraftMonthToBase } from "@/lib/tracking-data";

// "Reset to Base" for one Forward Simulation draft month. Restricted to
// periods strictly after Next Month — this must never be reachable against
// Current/Previous/Next (which have their own edit semantics and real
// bank-balance reconciliation) even if someone hits the route directly.
export async function POST(req: NextRequest, { params }: { params: Promise<{ year: string; month: string }> }) {
  const { year: yearParam, month: monthParam } = await params;
  const year = Number(yearParam);
  const month = Number(monthParam);

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month." }, { status: 400 });
  }

  const timeZone = await getHouseholdTimeZone(session.householdId);
  if (!(await isFutureDraftPeriod({ year, month }, timeZone))) {
    return NextResponse.json({ error: "Only draft months beyond Next Month can be reset here." }, { status: 400 });
  }

  await resetDraftMonthToBase(session.householdId, year, month);
  return NextResponse.json({ ok: true });
}
