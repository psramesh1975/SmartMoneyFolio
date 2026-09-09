import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getYearPayload, getHouseholdTimeZone } from "@/lib/monthly-data";
import { getMostRecentArchivedYear } from "@/lib/monthly-periods";

export async function GET(req: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const timeZone = await getHouseholdTimeZone(session.householdId);
  const year = Number(yearStr);
  if (!Number.isInteger(year) || year > getMostRecentArchivedYear(timeZone)) {
    return NextResponse.json({ error: "That year isn't archived yet." }, { status: 404 });
  }

  const payload = await getYearPayload(session.householdId, year);
  return NextResponse.json(payload);
}
