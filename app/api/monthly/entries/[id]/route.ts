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
    include: { lineItem: { include: { liability: true, account: { include: { security: true } } } } },
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

  // SIP -> Mutual Fund holding auto-sync. Same trigger and idempotency shape
  // as the EMI branch above, scoped to accountId links (Mutual Fund accounts
  // only). A line item links to at most one of liability/account, so these
  // two branches never both fire for the same entry.
  const account = entry.lineItem?.account ?? null;
  let sipUnitsApplied: number | null | undefined; // undefined = leave untouched
  let sipCostApplied: number | null | undefined;
  let sipPriceUnresolved = false; // surfaced in the response so the UI can flag it

  if (account && wasUnpaid && willBePaid) {
    // Newly marked paid: resolve a price off the security's last synced
    // price, falling back to the account's own avgBuyPrice. No resolvable
    // price (brand new security, sync hasn't run, no avgBuyPrice set
    // either) — don't guess: actualAmount still saves below, the unit
    // purchase just doesn't happen.
    const price = account.security?.lastPrice
      ? Number(account.security.lastPrice)
      : account.avgBuyPrice
        ? Number(account.avgBuyPrice)
        : null;

    if (price && price > 0) {
      const sipAmount = Number(parsed.data.actualAmount);
      const unitsPurchased = sipAmount / price;
      const oldUnits = Number(account.unitsHeld ?? 0);
      const oldAvgPrice = Number(account.avgBuyPrice ?? price);
      const oldTotalCost = oldUnits * oldAvgPrice;

      const newUnits = oldUnits + unitsPurchased;
      const newAvgBuyPrice = (oldTotalCost + sipAmount) / newUnits;

      await prisma.account.update({
        where: { id: account.id },
        data: {
          unitsHeld: newUnits,
          avgBuyPrice: newAvgBuyPrice,
          currentValue: newUnits * price,
        },
      });

      sipUnitsApplied = unitsPurchased;
      sipCostApplied = sipAmount;
    } else {
      sipPriceUnresolved = true;
    }
  } else if (account && !wasUnpaid && willBeUnpaid && entry.sipUnitsApplied && entry.sipCostApplied) {
    // Un-marking a previously-paid entry: reverse exactly the units and cost
    // that were applied for THIS entry, restoring the prior weighted average.
    const unitsToRemove = Number(entry.sipUnitsApplied);
    const costToRemove = Number(entry.sipCostApplied);
    const oldUnits = Number(account.unitsHeld ?? 0);
    const oldAvgPrice = Number(account.avgBuyPrice ?? 0);
    const oldTotalCost = oldUnits * oldAvgPrice;

    const newUnits = oldUnits - unitsToRemove;
    const newAvgBuyPrice = newUnits > 0 ? (oldTotalCost - costToRemove) / newUnits : 0;
    const latestPrice = account.security?.lastPrice ? Number(account.security.lastPrice) : newAvgBuyPrice;

    await prisma.account.update({
      where: { id: account.id },
      data: {
        unitsHeld: newUnits,
        avgBuyPrice: newAvgBuyPrice,
        currentValue: newUnits * latestPrice,
      },
    });

    sipUnitsApplied = null;
    sipCostApplied = null;
  }
  // Editing an already-paid SIP entry's actualAmount does NOT re-trigger a
  // purchase — same deliberate non-recompute as the EMI branch.

  // plannedAmount is this month's own editable plan and is fair game on any
  // entry, recurring-linked or one-off — it defaults from the line item's
  // baseAmount at generation but diverges freely from there. baseAmount
  // itself is a snapshot and is never accepted by this route.
  const updated = await prisma.monthlyEntry.update({
    where: { id: entry.id },
    data: {
      ...parsed.data,
      ...(principalAppliedAmount !== undefined ? { principalAppliedAmount } : {}),
      ...(sipUnitsApplied !== undefined ? { sipUnitsApplied } : {}),
      ...(sipCostApplied !== undefined ? { sipCostApplied } : {}),
    },
  });

  return NextResponse.json({ entry: updated, ...(sipPriceUnresolved ? { sipPriceUnresolved: true } : {}) });
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
