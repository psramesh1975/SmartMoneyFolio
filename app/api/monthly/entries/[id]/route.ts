import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeAmortization } from "@/lib/amortization";

const patchSchema = z.object({
  plannedAmount: z.coerce.number().positive().optional(),
  actualAmount: z.coerce.number().nonnegative().nullable().optional(),
  isSkipped: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const entry = await prisma.monthlyEntry.findFirst({
    where: { id, householdId: session.householdId },
    include: { lineItem: { include: { liability: true } } },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Some details are missing or invalid." }, { status: 400 });
  }

  // EMI -> principal auto-sync. Trigger is actualAmount transitioning
  // null <-> non-null — that's what "marking as paid" means in this codebase
  // today, there's no separate isPaid boolean. One-directional and
  // idempotent: paid -> balance drops once, un-paid -> balance restores
  // exactly once, edited-while-paid -> no change to the loan (the split was
  // locked in at the moment it was first marked paid).
  const liability = entry.lineItem?.liability ?? null;
  const wasUnpaid = entry.actualAmount === null;
  const willBePaid = parsed.data.actualAmount !== undefined && parsed.data.actualAmount !== null;
  const willBeUnpaid = parsed.data.actualAmount === null;

  let principalAppliedAmount: number | null | undefined; // undefined = leave untouched

  if (liability && wasUnpaid && willBePaid) {
    // Newly marked paid: compute this month's principal portion off the
    // CURRENT balance (a live snapshot at the moment of marking paid,
    // matching how the rest of the amortization math in this app works —
    // not retroactive).
    const breakdown = computeAmortization({
      outstandingBalance: Number(liability.outstandingBalance),
      originalAmount: liability.originalAmount ? Number(liability.originalAmount) : null,
      interestRate: liability.interestRate ? Number(liability.interestRate) : null,
      emiAmount: liability.emiAmount ? Number(liability.emiAmount) : null,
      targetPayoffDate: liability.targetPayoffDate,
    });

    if (breakdown.isAmortizing && breakdown.monthlyPrincipal !== null) {
      await prisma.liability.update({
        where: { id: liability.id },
        data: { outstandingBalance: Number(liability.outstandingBalance) - breakdown.monthlyPrincipal },
      });
      principalAppliedAmount = breakdown.monthlyPrincipal;
    }
    // Non-amortizing liabilities (credit cards, 0% EMIs) have nothing to
    // apply here — their balance is a running total set directly, not
    // reduced via amortization. Marking their EMI "paid" is informational.
  } else if (liability && !wasUnpaid && willBeUnpaid && entry.principalAppliedAmount) {
    // Un-marking a previously-paid entry: reverse exactly what was applied,
    // no more, no less.
    await prisma.liability.update({
      where: { id: liability.id },
      data: { outstandingBalance: Number(liability.outstandingBalance) + Number(entry.principalAppliedAmount) },
    });
    principalAppliedAmount = null;
  }
  // Editing an already-paid entry's actualAmount (non-null -> different
  // non-null) does NOT recompute or re-apply principal — deliberately left
  // untouched above (principalAppliedAmount stays undefined in that branch).

  // plannedAmount is this month's own editable plan and is fair game on any
  // entry, recurring-linked or one-off — it defaults from the line item's
  // baseAmount at generation but diverges freely from there. baseAmount
  // itself is a snapshot and is never accepted by this route.
  const updated = await prisma.monthlyEntry.update({
    where: { id: entry.id },
    data: {
      ...parsed.data,
      ...(principalAppliedAmount !== undefined ? { principalAppliedAmount } : {}),
    },
  });

  return NextResponse.json({ entry: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const entry = await prisma.monthlyEntry.findFirst({
    where: { id, householdId: session.householdId },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  if (entry.lineItemId) {
    return NextResponse.json(
      { error: "This is a recurring line — skip this occurrence instead of deleting it." },
      { status: 400 }
    );
  }

  await prisma.monthlyEntry.delete({ where: { id: entry.id } });
  return NextResponse.json({ ok: true });
}
