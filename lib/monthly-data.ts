import { prisma } from "@/lib/db";
import { ensureMonthGenerated } from "@/lib/monthly-generate";
import { computeMonthlySummary } from "@/lib/monthly-summary";
import type {
  AccountOptionDTO,
  LiabilityOptionDTO,
  MonthlyBaseRowDTO,
  MonthlyCategoryDTO,
  MonthlyCategoryOptionDTO,
  MonthlyEntryDTO,
  MonthlyMonthPayload,
  MonthlyYearPayload,
} from "@/lib/monthly-types";

// Every Monthly Tracking page/route needs the household's timezone before it
// can resolve "which month is Current" — centralized here so nobody forgets
// the "UTC" fallback for households (or the pre-timezone accounts on this
// deploy) that don't have one set.
export async function getHouseholdTimeZone(householdId: string): Promise<string> {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { timeZone: true },
  });
  return household?.timeZone || "UTC";
}

// Shared by the month API route and the server-component pages (Current/
// Previous/Next), so both go through the exact same generation + fetch +
// summary logic instead of the page re-fetching its own API.
export async function getMonthPayload(
  householdId: string,
  year: number,
  month: number
): Promise<MonthlyMonthPayload> {
  await ensureMonthGenerated(householdId, year, month);

  const [categories, entries] = await Promise.all([
    prisma.monthlyCategory.findMany({
      where: { householdId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.monthlyEntry.findMany({
      where: { householdId, year, month },
      include: { lineItem: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const entriesByCategory = new Map<string, MonthlyEntryDTO[]>();
  for (const e of entries) {
    const dto: MonthlyEntryDTO = {
      id: e.id,
      categoryId: e.categoryId,
      lineItemId: e.lineItemId,
      name: e.name,
      baseAmount: e.baseAmount.toString(),
      plannedAmount: e.plannedAmount.toString(),
      actualAmount: e.actualAmount?.toString() ?? null,
      isSkipped: e.isSkipped,
      notes: e.notes,
      lineItem: e.lineItem
        ? {
            id: e.lineItem.id,
            baseAmount: e.lineItem.baseAmount.toString(),
            repeatMonths: e.lineItem.repeatMonths,
            isActive: e.lineItem.isActive,
          }
        : null,
    };
    const list = entriesByCategory.get(e.categoryId) ?? [];
    list.push(dto);
    entriesByCategory.set(e.categoryId, list);
  }

  const categoryDTOs: MonthlyCategoryDTO[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    sortOrder: c.sortOrder,
    spendKind: c.spendKind,
    isSubscription: c.isSubscription,
    entries: entriesByCategory.get(c.id) ?? [],
  }));

  const summary = computeMonthlySummary(
    categories.flatMap((c) =>
      (entriesByCategory.get(c.id) ?? []).map((e) => ({
        categoryType: c.type,
        plannedAmount: e.plannedAmount,
        actualAmount: e.actualAmount,
        isSkipped: e.isSkipped,
      }))
    )
  );

  return { year, month, categories: categoryDTOs, summary };
}

// The Monthly Base setup page: one flat list of active line items (no
// grouping by category — that's just a column here), plus the household's
// categories for the row-level category picker. No entries, no Planned or
// Actual — Base is the template, not a month.
export async function getFlatBasePayload(householdId: string): Promise<{
  lineItems: MonthlyBaseRowDTO[];
  categories: MonthlyCategoryOptionDTO[];
  liabilities: LiabilityOptionDTO[];
  accounts: AccountOptionDTO[];
}> {
  const [lineItems, categories, liabilities, accounts] = await Promise.all([
    prisma.monthlyLineItem.findMany({
      where: { householdId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.monthlyCategory.findMany({
      where: { householdId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.liability.findMany({
      where: { householdId },
      select: { id: true, name: true, emiAmount: true },
      orderBy: { createdAt: "asc" },
    }),
    // Mutual Fund accounts only — SIP linking is scoped to assetClass =
    // MUTUAL_FUNDS (stocks aren't bought via recurring SIP in this app's model).
    prisma.account.findMany({
      where: { householdId, assetClass: "MUTUAL_FUNDS" },
      select: { id: true, holdingName: true, sipMonthlyAmount: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    lineItems: lineItems.map((li) => ({
      id: li.id,
      name: li.name,
      baseAmount: li.baseAmount.toString(),
      categoryId: li.categoryId,
      liabilityId: li.liabilityId,
      accountId: li.accountId,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      spendKind: c.spendKind,
      isSubscription: c.isSubscription,
    })),
    liabilities: liabilities.map((l) => ({
      id: l.id,
      name: l.name,
      emiAmount: l.emiAmount?.toString() ?? null,
    })),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.holdingName,
      sipMonthlyAmount: a.sipMonthlyAmount?.toString() ?? null,
    })),
  };
}

// Read-only counterpart used by "Earlier Months" — deliberately does NOT call
// ensureMonthGenerated. Only Current/Previous/Next ever create entries; a
// month nobody visited while it was editable simply has none, and should
// stay that way rather than backfilling with today's line-item amounts.
// Categories with no entries that month are omitted, same as the year view.
export async function getReadOnlyMonthPayload(
  householdId: string,
  year: number,
  month: number
): Promise<MonthlyMonthPayload> {
  const [categories, entries] = await Promise.all([
    prisma.monthlyCategory.findMany({
      where: { householdId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.monthlyEntry.findMany({
      where: { householdId, year, month },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const entriesByCategory = new Map<string, MonthlyEntryDTO[]>();
  for (const e of entries) {
    const dto: MonthlyEntryDTO = {
      id: e.id,
      categoryId: e.categoryId,
      lineItemId: e.lineItemId,
      name: e.name,
      baseAmount: e.baseAmount.toString(),
      plannedAmount: e.plannedAmount.toString(),
      actualAmount: e.actualAmount?.toString() ?? null,
      isSkipped: e.isSkipped,
      notes: e.notes,
      lineItem: null,
    };
    const list = entriesByCategory.get(e.categoryId) ?? [];
    list.push(dto);
    entriesByCategory.set(e.categoryId, list);
  }

  const categoryDTOs: MonthlyCategoryDTO[] = categories
    .filter((c) => entriesByCategory.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      sortOrder: c.sortOrder,
      spendKind: c.spendKind,
      isSubscription: c.isSubscription,
      entries: entriesByCategory.get(c.id) ?? [],
    }));

  const summary = computeMonthlySummary(
    categories.flatMap((c) =>
      (entriesByCategory.get(c.id) ?? []).map((e) => ({
        categoryType: c.type,
        plannedAmount: e.plannedAmount,
        actualAmount: e.actualAmount,
        isSkipped: e.isSkipped,
      }))
    )
  );

  return { year, month, categories: categoryDTOs, summary };
}

// Read-only: no generation here — an archived year's entries are exactly
// whatever existed when those months were current/previous/next.
export async function getYearPayload(
  householdId: string,
  year: number
): Promise<MonthlyYearPayload> {
  const [categories, entries] = await Promise.all([
    prisma.monthlyCategory.findMany({
      where: { householdId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.monthlyEntry.findMany({
      where: { householdId, year },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const categoryType = new Map(categories.map((c) => [c.id, c.type] as const));

  const months: MonthlyMonthPayload[] = [];
  for (let month = 1; month <= 12; month++) {
    const monthEntries = entries.filter((e) => e.month === month);
    const entriesByCategory = new Map<string, MonthlyEntryDTO[]>();
    for (const e of monthEntries) {
      const dto: MonthlyEntryDTO = {
        id: e.id,
        categoryId: e.categoryId,
        lineItemId: e.lineItemId,
        name: e.name,
        baseAmount: e.baseAmount.toString(),
        plannedAmount: e.plannedAmount.toString(),
        actualAmount: e.actualAmount?.toString() ?? null,
        isSkipped: e.isSkipped,
        notes: e.notes,
        lineItem: null, // read-only view — recurring-line editing isn't offered here
      };
      const list = entriesByCategory.get(e.categoryId) ?? [];
      list.push(dto);
      entriesByCategory.set(e.categoryId, list);
    }

    const monthCategories: MonthlyCategoryDTO[] = categories
      .filter((c) => entriesByCategory.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        sortOrder: c.sortOrder,
        spendKind: c.spendKind,
        isSubscription: c.isSubscription,
        entries: entriesByCategory.get(c.id) ?? [],
      }));

    const summary = computeMonthlySummary(
      monthEntries.map((e) => ({
        categoryType: categoryType.get(e.categoryId) ?? "OUTFLOW",
        plannedAmount: e.plannedAmount.toString(),
        actualAmount: e.actualAmount?.toString() ?? null,
        isSkipped: e.isSkipped,
      }))
    );

    months.push({ year, month, categories: monthCategories, summary });
  }

  const yearlySummary = computeMonthlySummary(
    entries.map((e) => ({
      categoryType: categoryType.get(e.categoryId) ?? "OUTFLOW",
      plannedAmount: e.plannedAmount.toString(),
      actualAmount: e.actualAmount?.toString() ?? null,
      isSkipped: e.isSkipped,
    }))
  );

  return { year, months, yearlySummary };
}
