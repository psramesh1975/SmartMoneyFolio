import { prisma } from "@/lib/db";
import { ensureMonthGenerated } from "@/lib/monthly-generate";
import { reconcileAutoLinkedLineItems } from "@/lib/monthly-auto-sync";
import { computeMonthlySummary } from "@/lib/monthly-summary";
import type {
  FlatBasePayload,
  MonthlyCategoryDTO,
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
  await reconcileAutoLinkedLineItems(householdId);
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
      scheduledDay: e.scheduledDay,
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

// The Monthly Base setup page: Debt (EMI) and SIP rows are auto-linked and
// read-only here (sourced from Liabilities/Assets — see
// lib/monthly-auto-sync.ts). Everything else is a manual recurring line,
// split by its category's type into Income and Expense — previously this
// split didn't exist and every non-system category (Income included) was
// silently counted as outflow; see the Income KPIs below. No entries, no
// Planned or Actual — Base is the template, not a month.
export async function getFlatBasePayload(householdId: string): Promise<FlatBasePayload> {
  const { debtCategoryId, sipCategoryId } = await reconcileAutoLinkedLineItems(householdId);

  const [debtItems, sipItems, generalItems, allCategories] = await Promise.all([
    prisma.monthlyLineItem.findMany({
      where: { householdId, isActive: true, categoryId: debtCategoryId },
      include: { liability: { select: { id: true, accountReference: true, emiDueDay: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.monthlyLineItem.findMany({
      where: { householdId, isActive: true, categoryId: sipCategoryId },
      include: { account: { select: { id: true, accountOrFolioNo: true, sipDueDay: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.monthlyLineItem.findMany({
      where: {
        householdId,
        isActive: true,
        categoryId: { notIn: [debtCategoryId, sipCategoryId] },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.monthlyCategory.findMany({
      where: { householdId, id: { notIn: [debtCategoryId, sipCategoryId] } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const incomeCategories = allCategories.filter((c) => c.type === "INCOME");
  const expenseCategories = allCategories.filter((c) => c.type === "OUTFLOW");
  const incomeCategoryIds = new Set(incomeCategories.map((c) => c.id));

  const toFlatRow = (li: (typeof generalItems)[number]) => ({
    id: li.id,
    name: li.name,
    baseAmount: li.baseAmount.toString(),
    categoryId: li.categoryId,
    scheduleDay: li.scheduleDay,
    paymentMethod: li.paymentMethod,
  });

  const incomeRows = generalItems.filter((li) => incomeCategoryIds.has(li.categoryId)).map(toFlatRow);
  const expenseRows = generalItems.filter((li) => !incomeCategoryIds.has(li.categoryId)).map(toFlatRow);

  const debtRows = debtItems.map((li) => ({
    id: li.id,
    name: li.name,
    baseAmount: li.baseAmount.toString(),
    subtitle: li.liability?.accountReference ?? null,
    kind: "EMI" as const,
    sourceId: li.liability?.id ?? null,
    dueDay: li.liability?.emiDueDay ?? null,
  }));
  const sipRows = sipItems.map((li) => ({
    id: li.id,
    name: li.name,
    baseAmount: li.baseAmount.toString(),
    subtitle: li.account?.accountOrFolioNo ?? null,
    kind: "SIP" as const,
    sourceId: li.account?.id ?? null,
    dueDay: li.account?.sipDueDay ?? null,
  }));

  const sum = (rows: { baseAmount: string }[]) => rows.reduce((s, r) => s + Number(r.baseAmount), 0);
  const totalIncome = sum(incomeRows);
  const debtServicing = sum(debtRows);
  const sipContributions = sum(sipRows);
  const wealthBuilding = debtServicing + sipContributions;
  const generalExpenseTotal = sum(expenseRows);
  const totalOutflow = wealthBuilding + generalExpenseTotal;
  const fixedLiving = totalOutflow - wealthBuilding;
  const netBuffer = totalIncome - totalOutflow;

  const toCategoryOption = (c: (typeof allCategories)[number]) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    spendKind: c.spendKind,
    isSubscription: c.isSubscription,
  });

  return {
    incomeRows,
    expenseRows,
    debtRows,
    sipRows,
    incomeCategories: incomeCategories.map(toCategoryOption),
    expenseCategories: expenseCategories.map(toCategoryOption),
    categories: allCategories.map(toCategoryOption), // kept for ManageCategoriesPanel, which shows both types
    kpis: {
      totalIncome: totalIncome.toFixed(2),
      totalOutflow: totalOutflow.toFixed(2),
      debtServicing: debtServicing.toFixed(2),
      sipContributions: sipContributions.toFixed(2),
      wealthBuilding: wealthBuilding.toFixed(2),
      wealthBuildingPercent: totalOutflow > 0 ? Math.round((wealthBuilding / totalOutflow) * 100) : 0,
      fixedLiving: fixedLiving.toFixed(2),
      fixedLivingPercent: totalOutflow > 0 ? Math.round((fixedLiving / totalOutflow) * 100) : 0,
      netBuffer: netBuffer.toFixed(2),
      netBufferPercent: totalIncome > 0 ? Math.round((netBuffer / totalIncome) * 100) : 0,
    },
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
      scheduledDay: e.scheduledDay,
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
        scheduledDay: e.scheduledDay,
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
