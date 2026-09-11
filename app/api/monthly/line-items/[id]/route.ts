import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const repeatMonthSchema = z.number().int().min(1).max(12);

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  // nonnegative, not positive — Monthly Base allows a row to sit at 0.00.
  baseAmount: z.coerce.number().nonnegative().optional(),
  repeatMonths: z.array(repeatMonthSchema).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  liabilityId: z.string().min(1).nullable().optional(),
  // Mutually exclusive with liabilityId — a line item links to at most one
  // of a Liability (EMI) or an Account (SIP), enforced below.
  accountId: z.string().min(1).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const lineItem = await prisma.monthlyLineItem.findFirst({
    where: { id, householdId: session.householdId },
  });
  if (!lineItem) return NextResponse.json({ error: "Line item not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Some details are missing or invalid." }, { status: 400 });
  }

  if (parsed.data.categoryId) {
    const category = await prisma.monthlyCategory.findFirst({
      where: { id: parsed.data.categoryId, householdId: session.householdId },
    });
    if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  if (parsed.data.liabilityId) {
    const liability = await prisma.liability.findFirst({
      where: { id: parsed.data.liabilityId, householdId: session.householdId },
    });
    if (!liability) return NextResponse.json({ error: "That liability wasn't found." }, { status: 400 });
  }

  if (parsed.data.accountId) {
    // SIP linking is scoped to Mutual Fund accounts only — see decisions in
    // the Phase 14 spec.
    const account = await prisma.account.findFirst({
      where: { id: parsed.data.accountId, householdId: session.householdId, assetClass: "MUTUAL_FUNDS" },
    });
    if (!account) return NextResponse.json({ error: "That mutual fund account wasn't found." }, { status: 400 });
  }

  // A line item links to at most one of Liability/Account — check the
  // state this patch would leave it in (existing value where this patch
  // doesn't touch a field), not just what's in the request body.
  const nextLiabilityId = parsed.data.liabilityId !== undefined ? parsed.data.liabilityId : lineItem.liabilityId;
  const nextAccountId = parsed.data.accountId !== undefined ? parsed.data.accountId : lineItem.accountId;
  if (nextLiabilityId && nextAccountId) {
    return NextResponse.json(
      { error: "A line item can link to a Liability or an Account, not both." },
      { status: 400 }
    );
  }

  // Only affects entries not yet generated — existing MonthlyEntry rows for
  // months already snapshotted are never touched here.
  const updated = await prisma.monthlyLineItem.update({
    where: { id: lineItem.id },
    data: parsed.data,
  });

  return NextResponse.json({ lineItem: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const lineItem = await prisma.monthlyLineItem.findFirst({
    where: { id, householdId: session.householdId },
  });
  if (!lineItem) return NextResponse.json({ error: "Line item not found." }, { status: 404 });

  // Soft-stop rather than a hard delete, so existing entries keep their
  // lineItemId (and thus their edit history) instead of being orphaned.
  const updated = await prisma.monthlyLineItem.update({
    where: { id: lineItem.id },
    data: { isActive: false },
  });

  return NextResponse.json({ lineItem: updated });
}
