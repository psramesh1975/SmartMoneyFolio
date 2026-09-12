import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getMonthPayload, getHouseholdTimeZone } from "@/lib/monthly-data";
import { getNextPeriod } from "@/lib/monthly-periods";
import { isWithinDraftRange } from "@/lib/tracking-data";

const bodySchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

// Initializes a new Forward Simulation draft month ("Add Another Month" in
// the sidebar's Future Months section): generates it from the current
// Monthly Base blueprint (same idempotent getMonthPayload() every editable
// month page uses) so it shows up as a draft immediately. Refuses anything
// at or before Next Month (those have their own pages) or absurdly far out.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a year and month." }, { status: 400 });
  }

  const timeZone = await getHouseholdTimeZone(session.householdId);
  const next = getNextPeriod(timeZone);
  if (!isWithinDraftRange(parsed.data, timeZone, next)) {
    return NextResponse.json(
      { error: "Pick a month after Next Month (and not too far out)." },
      { status: 400 }
    );
  }

  await getMonthPayload(session.householdId, parsed.data.year, parsed.data.month);
  return NextResponse.json({ ok: true, year: parsed.data.year, month: parsed.data.month });
}
