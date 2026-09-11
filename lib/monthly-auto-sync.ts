import { prisma } from "@/lib/db";

const DEBT_CATEGORY_NAME = "Loan EMIs";
const SIP_CATEGORY_NAME = "Investments & SIPs";

async function getOrCreateSystemCategory(householdId: string, name: string) {
  const existing = await prisma.monthlyCategory.findFirst({
    where: { householdId, name, type: "OUTFLOW" },
  });
  if (existing) return existing;
  return prisma.monthlyCategory.create({
    data: { householdId, name, type: "OUTFLOW", spendKind: "FIXED" },
  });
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

  // Create or sync a Debt row for every qualifying liability.
  for (const liability of qualifyingLiabilities) {
    const existing = byLiabilityId.get(liability.id);
    const name = liability.name;
    const baseAmount = liability.emiAmount!; // Decimal, qualifying filter already checked > 0

    if (!existing) {
      await prisma.monthlyLineItem.create({
        data: {
          householdId,
          categoryId: debtCategory.id,
          liabilityId: liability.id,
          name,
          baseAmount,
          startYear: new Date().getFullYear(),
          startMonth: new Date().getMonth() + 1,
        },
      });
    } else if (
      !existing.isActive ||
      existing.name !== name ||
      Number(existing.baseAmount) !== Number(baseAmount)
    ) {
      await prisma.monthlyLineItem.update({
        where: { id: existing.id },
        data: { name, baseAmount, isActive: true },
      });
    }
  }

  // Create or sync a SIP row for every qualifying mutual fund account.
  for (const account of qualifyingAccounts) {
    const existing = byAccountId.get(account.id);
    const name = account.holdingName;
    const baseAmount = account.sipMonthlyAmount!;

    if (!existing) {
      await prisma.monthlyLineItem.create({
        data: {
          householdId,
          categoryId: sipCategory.id,
          accountId: account.id,
          name,
          baseAmount,
          startYear: new Date().getFullYear(),
          startMonth: new Date().getMonth() + 1,
        },
      });
    } else if (
      !existing.isActive ||
      existing.name !== name ||
      Number(existing.baseAmount) !== Number(baseAmount)
    ) {
      await prisma.monthlyLineItem.update({
        where: { id: existing.id },
        data: { name, baseAmount, isActive: true },
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
