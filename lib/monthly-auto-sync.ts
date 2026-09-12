import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Exported so callers that need to tell an auto-linked EMI/SIP row apart
// from a general recurring line item (e.g. lib/tracking-data.ts's Forward
// Simulation source-type labeling) match against the same two literal names
// this file creates, instead of a second, driftable copy of the strings.
export const DEBT_CATEGORY_NAME = "Loan EMIs";
export const SIP_CATEGORY_NAME = "Investments & SIPs";

// reconcileAutoLinkedLineItems() runs on every /monthly/base load, so
// concurrent requests for the same household (multiple tabs, or just two
// page loads racing) hit this at once. A plain findFirst-then-create here
// let both requests pass the check before either finished creating,
// producing duplicate categories.
//
// upsert() alone is not enough to close that race: under real concurrency
// against this DB (verified with 12 parallel calls via
// scripts/_race-check.ts during development), multiple upserts can each
// attempt the create side and one throws P2002 from the @@unique
// ([householdId, name, type]) constraint rather than silently resolving to
// the update side — Prisma's upsert is not a single atomic statement here.
// So P2002 is caught explicitly: whichever call lost the race just reads
// back the row the winner created, which by definition now exists.
async function getOrCreateSystemCategory(householdId: string, name: string) {
  try {
    return await prisma.monthlyCategory.upsert({
      where: { householdId_name_type: { householdId, name, type: "OUTFLOW" } },
      update: {},
      create: { householdId, name, type: "OUTFLOW", spendKind: "FIXED" },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return prisma.monthlyCategory.findFirstOrThrow({
        where: { householdId, name, type: "OUTFLOW" },
      });
    }
    throw err;
  }
}

// reconcileAutoLinkedLineItems() previously decided create-vs-sync from a
// single snapshot read of existing linked line items taken at the top of
// the function — under concurrent calls for the same household, several
// could each see "nothing linked to this liability/account yet" and each
// create their own row, producing duplicates that then double-count the
// EMI/SIP amount in Total Monthly Base Outflow (empirically reproduced: 12
// concurrent calls against a fresh household produced 12 duplicate rows for
// the same single liability). This upsert against the DB's
// @@unique([householdId, liabilityId]) / @@unique([householdId, accountId])
// constraints closes that race the same way getOrCreateSystemCategory does
// above — including the same P2002 catch-and-refetch, since a bare
// upsert() alone was proven not to be atomic against this DB under real
// concurrency (see the comment on getOrCreateSystemCategory).
async function upsertLinkedLineItem(params: {
  householdId: string;
  categoryId: string;
  liabilityId?: string;
  accountId?: string;
  name: string;
  baseAmount: Prisma.Decimal | number;
}) {
  const { householdId, categoryId, liabilityId, accountId, name, baseAmount } = params;
  const where = liabilityId
    ? { householdId_liabilityId: { householdId, liabilityId } }
    : { householdId_accountId: { householdId, accountId: accountId! } };
  const update = { name, baseAmount, isActive: true };

  try {
    return await prisma.monthlyLineItem.upsert({
      where,
      update,
      create: {
        householdId,
        categoryId,
        liabilityId,
        accountId,
        name,
        baseAmount,
        startYear: new Date().getFullYear(),
        startMonth: new Date().getMonth() + 1,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return prisma.monthlyLineItem.update({ where, data: update });
    }
    throw err;
  }
}

// Called at the top of every read path that needs an up-to-date Monthly
// Base: the Base setup page and month generation (Current/Next). Idempotent
// and cheap at household scale — same "not a performance concern" trade-off
// already made elsewhere in this codebase (e.g. the price-sync loop).
//
// Replaces the old manual liability/account dropdown on Monthly Base:
// linking is now fully automatic, driven off Liability.emiAmount and
// Account.sipMonthlyAmount, matching the app's existing "compute live"
// conventions (live amortization, Next Month's live re-sync of Base values)
// rather than adding write-hooks to six different Liability/Account route
// handlers.
export async function reconcileAutoLinkedLineItems(householdId: string) {
  const [debtCategory, sipCategory, liabilities, sipAccounts, linkedLineItems] =
    await Promise.all([
      getOrCreateSystemCategory(householdId, DEBT_CATEGORY_NAME),
      getOrCreateSystemCategory(householdId, SIP_CATEGORY_NAME),
      prisma.liability.findMany({
        where: { householdId, emiAmount: { not: null } },
      }),
      prisma.account.findMany({
        where: { householdId, assetClass: "MUTUAL_FUNDS", sipMonthlyAmount: { not: null } },
      }),
      // Every currently-linked line item, active or not — needed to decide
      // create vs. sync vs. soft-stop in one pass.
      prisma.monthlyLineItem.findMany({
        where: { householdId, OR: [{ liabilityId: { not: null } }, { accountId: { not: null } }] },
      }),
    ]);

  // Only Liabilities with a fixed emiAmount > 0 auto-populate a Debt row —
  // revolving lines with no fixed EMI (credit cards, isRevolving with no
  // emiAmount) have nothing steady to show. Only Accounts with a
  // sipMonthlyAmount > 0 auto-populate a SIP row.
  const qualifyingLiabilities = liabilities.filter((l) => Number(l.emiAmount) > 0);
  const qualifyingAccounts = sipAccounts.filter((a) => Number(a.sipMonthlyAmount) > 0);

  const byLiabilityId = new Map(linkedLineItems.filter((li) => li.liabilityId).map((li) => [li.liabilityId!, li]));
  const byAccountId = new Map(linkedLineItems.filter((li) => li.accountId).map((li) => [li.accountId!, li]));

  // Create or sync a Debt row for every qualifying liability. Skips the
  // no-op case (already active, name/amount unchanged) to avoid a write on
  // every single page load; upsertLinkedLineItem's own update branch always
  // sets isActive: true regardless, so a stopped row with an unchanged
  // name/amount still gets correctly reactivated by falling through to it.
  for (const liability of qualifyingLiabilities) {
    const existing = byLiabilityId.get(liability.id);
    const name = liability.name;
    const baseAmount = liability.emiAmount!; // Decimal, qualifying filter already checked > 0

    if (
      !existing ||
      !existing.isActive ||
      existing.name !== name ||
      Number(existing.baseAmount) !== Number(baseAmount)
    ) {
      await upsertLinkedLineItem({
        householdId,
        categoryId: debtCategory.id,
        liabilityId: liability.id,
        name,
        baseAmount,
      });
    }
  }

  // Create or sync a SIP row for every qualifying mutual fund account.
  for (const account of qualifyingAccounts) {
    const existing = byAccountId.get(account.id);
    const name = account.holdingName;
    const baseAmount = account.sipMonthlyAmount!;

    if (
      !existing ||
      !existing.isActive ||
      existing.name !== name ||
      Number(existing.baseAmount) !== Number(baseAmount)
    ) {
      await upsertLinkedLineItem({
        householdId,
        categoryId: sipCategory.id,
        accountId: account.id,
        name,
        baseAmount,
      });
    }
  }

  // Soft-stop any active linked line item whose source no longer qualifies
  // (liability deleted or emiAmount cleared; account's sipMonthlyAmount
  // cleared or assetClass changed away from MUTUAL_FUNDS).
  const qualifyingLiabilityIds = new Set(qualifyingLiabilities.map((l) => l.id));
  const qualifyingAccountIds = new Set(qualifyingAccounts.map((a) => a.id));
  const toStop = linkedLineItems.filter(
    (li) =>
      li.isActive &&
      ((li.liabilityId && !qualifyingLiabilityIds.has(li.liabilityId)) ||
        (li.accountId && !qualifyingAccountIds.has(li.accountId)))
  );
  for (const li of toStop) {
    await prisma.monthlyLineItem.update({ where: { id: li.id }, data: { isActive: false } });
  }

  return { debtCategoryId: debtCategory.id, sipCategoryId: sipCategory.id };
}
