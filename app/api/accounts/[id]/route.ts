import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";
import { ASSET_CLASS_VALUES } from "@/lib/asset-classes";

const COMPOUNDING_FREQUENCIES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL", "AT_MATURITY"] as const;
const AUTO_RENEWAL_TYPES = ["NONE", "PAYOUT_TO_ACCOUNT", "RENEW_PRINCIPAL_ONLY", "RENEW_PRINCIPAL_AND_INTEREST"] as const;

const updateSchema = z.object({
  familyMemberId: z.string().min(1).optional(),
  assetClass: z.enum(ASSET_CLASS_VALUES).optional(),
  holdingName: z.string().min(1).optional(),
  currency: z.enum(CURRENCY_CODES).optional(),
  currentValue: z.coerce.number().nonnegative().optional(),
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const existing = await prisma.account.findFirst({ where: { id, householdId: session.householdId } });
  if (!existing) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Some details are invalid." }, { status: 400 });

  const account = await prisma.account.update({
    where: { id },
    data: parsed.data,
    include: { familyMember: { select: { id: true, name: true } }, security: true },
  });
  return NextResponse.json({ account });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });
  const account = await prisma.account.findFirst({
    where: { id, householdId: session.householdId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  await prisma.account.delete({ where: { id: account.id } });
  return NextResponse.json({ ok: true });
}
