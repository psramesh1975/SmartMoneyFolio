import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMonthBreakdown } from "@/lib/monthly-breakdown";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { year: yearStr, month: monthStr } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month." }, { status: 400 });
  }

  const periodParam = req.nextUrl.searchParams.get("period");
  const period = periodParam === "previous" ? "previous" : "current";

  // Read-only analysis over whatever entries already exist — unlike
  // getMonthPayload, this never calls ensureMonthGenerated. If the month
  // hasn't been visited yet this session, the panel just shows empty/zero
  // states, which is correct here, not a bug.
  const breakdown = await getMonthBreakdown(session.householdId, year, month, { periodKind: period });
  return NextResponse.json({ breakdown });
}
