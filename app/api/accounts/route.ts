import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";

const ASSET_CLASSES = [
  "CASH",
  "FIXED_DEPOSIT",
  "STOCKS",
  "MUTUAL_FUNDS",
  "BONDS",
  "GOLD",
  "RETIREMENT_SAVINGS",
  "INSURANCE_LINKED",
  "REAL_ESTATE",
  "CRYPTOCURRENCY",
  "OTHER",
] as const;

const createSchema = z.object({
  familyMemberId: z.string().min(1),
  assetClass: z.enum(ASSET_CLASSES),
  holdingName: z.string().min(1),
  currency: z.enum(CURRENCY_CODES),
  currentValue: z.coerce.number().nonnegative(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const accounts = await prisma.account.findMany({
    where: { householdId: session.householdId },
    include: { familyMember: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });
  if (session.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers can't add accounts." }, { status: 403 });
  }

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

  const account = await prisma.account.create({
    data: {
      householdId: session.householdId,
      familyMemberId: parsed.data.familyMemberId,
      assetClass: parsed.data.assetClass,
      holdingName: parsed.data.holdingName,
      currency: parsed.data.currency,
      currentValue: parsed.data.currentValue,
    },
  });

  return NextResponse.json({ account });
}
