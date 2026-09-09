import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";

const RESIDENCY_STATUSES = ["NRI", "RESIDENT_INDIAN", "OTHER"] as const;

const schema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  operationalCurrency: z.enum(CURRENCY_CODES),
  residencyStatus: z.enum(RESIDENCY_STATUSES),
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

  const updated = await prisma.familyMember.update({
    where: { id: familyMember.id },
    data: {
      name: parsed.data.name,
      city: parsed.data.city,
      address: parsed.data.address,
      operationalCurrency: parsed.data.operationalCurrency,
      residencyStatus: parsed.data.residencyStatus,
    },
  });

  return NextResponse.json({ familyMember: updated });
}
