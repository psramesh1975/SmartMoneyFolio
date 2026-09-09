import { prisma } from "@/lib/db";

// Called by every editable-month page before rendering. Idempotent: only
// creates rows that don't exist yet, never touches existing ones — that's
// what makes "base amount changes apply forward only" work with zero extra
// bookkeeping. Editing a MonthlyLineItem later never rewrites a MonthlyEntry
// that was already generated from it.
export async function ensureMonthGenerated(householdId: string, year: number, month: number) {
  const lineItems = await prisma.monthlyLineItem.findMany({
    where: {
      householdId,
      isActive: true,
      OR: [{ startYear: { lt: year } }, { startYear: year, startMonth: { lte: month } }],
    },
  });

  const applicable = lineItems.filter(
    (li) => li.repeatMonths.length === 0 || li.repeatMonths.includes(month)
  );

  for (const li of applicable) {
    await prisma.monthlyEntry.upsert({
      where: { lineItemId_year_month: { lineItemId: li.id, year, month } },
      update: {},
      create: {
        householdId,
        categoryId: li.categoryId,
        lineItemId: li.id,
        year,
        month,
        name: li.name,
        baseAmount: li.baseAmount,
        plannedAmount: li.baseAmount, // starting point; user can edit independently from here
      },
    });
  }
}
