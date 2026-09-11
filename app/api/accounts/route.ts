import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";
import { ASSET_CLASS_VALUES } from "@/lib/asset-classes";

const COMPOUNDING_FREQUENCIES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL", "AT_MATURITY"] as const;
const AUTO_RENEWAL_TYPES = ["NONE", "PAYOUT_TO_ACCOUNT", "RENEW_PRINCIPAL_ONLY", "RENEW_PRINCIPAL_AND_INTEREST"] as const;

// One flexible schema for every asset class, same pattern as the Account
// model itself — a row only populates the fields relevant to its own
// assetClass, so everything category-specific here is optional.
const createSchema = z.object({
  familyMemberId: z.string().min(1),
  assetClass: z.enum(ASSET_CLASS_VALUES),
  holdingName: z.string().min(1),
  currency: z.enum(CURRENCY_CODES),
  currentValue: z.coerce.number().nonnegative(),
  purchaseValue: z.coerce.number().nonnegative().optional(),

  accountOrFolioNo: z.string().optional(),
  securityId: z.string().optional(),
  unitsHeld: z.coerce.number().nonnegative().optional(),
  avgBuyPrice: z.coerce.number().nonnegative().optional(),

  interestRatePct: z.coerce.number().min(0).max(100).optional(),
  startDate: z.coerce.date().optional(),
  maturityDate: z.coerce.date().optional(),
  compoundingFrequency: z.enum(COMPOUNDING_FREQUENCIES).optional(),
  autoRenewalType: z.enum(AUTO_RENEWAL_TYPES).optional(),
  isTaxExempt: z.boolean().optional(),

  sipMonthlyAmount: z.coerce.number().nonnegative().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const assetClassParam = req.nextUrl.searchParams.get("assetClass");
  const assetClass =
    assetClassParam && (ASSET_CLASS_VALUES as readonly string[]).includes(assetClassParam)
      ? (assetClassParam as (typeof ASSET_CLASS_VALUES)[number])
      : undefined;

  const accounts = await prisma.account.findMany({
    where: { householdId: session.householdId, ...(assetClass ? { assetClass } : {}) },
    include: { familyMember: { select: { id: true, name: true } }, security: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ accounts });
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

  const account = await prisma.account.create({
    data: { householdId: session.householdId, ...parsed.data },
    include: { familyMember: { select: { id: true, name: true } }, security: true },
  });

  return NextResponse.json({ account });
}
