import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMonthPayload } from "@/lib/monthly-data";

export async function GET(
  req: Request,
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

  const payload = await getMonthPayload(session.householdId, year, month);
  return NextResponse.json(payload);
}
