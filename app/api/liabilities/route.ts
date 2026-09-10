import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";

const LIABILITY_TYPES = ["HOME_LOAN", "CAR_LOAN", "PERSONAL_LOAN", "CREDIT_CARD", "DEVICE_EMI", "OTHER"] as const;

const createSchema = z.object({
  familyMemberId: z.string().min(1),
  liabilityType: z.enum(LIABILITY_TYPES),
  name: z.string().min(1),
  currency: z.enum(CURRENCY_CODES),
  outstandingBalance: z.coerce.number().nonnegative(),
  originalAmount: z.coerce.number().nonnegative().optional(),
  interestRate: z.coerce.number().min(0).max(100).optional(),
  emiAmount: z.coerce.number().nonnegative().optional(),
  targetPayoffDate: z.coerce.date().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const liabilities = await prisma.liability.findMany({
    where: { householdId: session.householdId },
    include: { familyMember: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ liabilities });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Some details are missing or invalid." }, { status: 400 });
  }

  // Make sure the family member actually belongs to this household.
  const member = await prisma.familyMember.findFirst({
    where: { id: parsed.data.familyMemberId, householdId: session.householdId },
  });
  if (!member) {
    return NextResponse.json({ error: "That family member wasn't found." }, { status: 400 });
  }

  const liability = await prisma.liability.create({
    data: { householdId: session.householdId, ...parsed.data },
  });

  return NextResponse.json({ liability });
}
