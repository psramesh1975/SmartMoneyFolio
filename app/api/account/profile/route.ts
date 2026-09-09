import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";
import { COUNTRY_CODES, isValidTimeZone } from "@/lib/countries";

const RESIDENCY_STATUSES = ["NRI", "RESIDENT_INDIAN", "OTHER"] as const;

const schema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  operationalCurrency: z.enum(CURRENCY_CODES),
  residencyStatus: z.enum(RESIDENCY_STATUSES),
  // Household-level, not per-profile — see note below. Optional here only so
  // this route still works for a family-member profile with no linked
  // household context to update; the Settings UI always sends both.
  country: z.enum(COUNTRY_CODES).optional(),
  timeZone: z.string().min(1).refine(isValidTimeZone, { message: "Not a valid timezone." }).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const familyMember = await prisma.familyMember.findUnique({
    where: { linkedUserId: session.userId },
  });
  if (!familyMember) {
    return NextResponse.json({ error: "No profile is linked to this login." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some details are missing or invalid. Please check the form and try again." },
      { status: 400 }
    );
  }

  const { country, timeZone, ...profileFields } = parsed.data;

  const [updated] = await Promise.all([
    prisma.familyMember.update({
      where: { id: familyMember.id },
      data: profileFields,
    }),
    // Country/timezone live on the Household, not this family member — apply
    // immediately to all period math on the next request, no guardrails for
    // a mid-cycle change (the rare month-boundary flip is harmless).
    session.householdId && (country || timeZone)
      ? prisma.household.update({
          where: { id: session.householdId },
          data: { ...(country ? { country } : {}), ...(timeZone ? { timeZone } : {}) },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({ familyMember: updated });
}
