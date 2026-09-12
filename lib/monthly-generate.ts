import { prisma } from "@/lib/db";

// Called by every editable-month page before rendering. Idempotent: only
// creates rows that don't exist yet, never touches existing ones — that's
// what makes "base amount changes apply forward only" work with zero extra
// bookkeeping. Editing a MonthlyLineItem later never rewrites a MonthlyEntry
// that was already generated from it.
//
// Deliberately not gated on startYear/startMonth: every active line item
// generates into every month it's asked about, regardless of when it was
// added to Base. Forward-only behavior doesn't depend on that gate — the
// upsert's `update: {}` no-op already means an entry generated for a given
// month is never rewritten, so a Base edit made today still only affects
// months generated after the edit. The startYear/startMonth columns stay on
// MonthlyLineItem unused for now.
// PERF-01: this used to await one prisma.monthlyEntry.upsert() per active
// line item in a sequential loop — N round trips to remote Neon Postgres for
// N line items, the dominant cost in the ~8s /dashboard render this fixes
// (a household with a dozen-plus Base categories/line items paid a network
// round trip, one at a time, for every single one, on every page that calls
// this). The upsert's `update: {}` never touched an existing row anyway, so
// this is exactly what createMany({ skipDuplicates: true }) does natively in
// a single statement: insert whichever rows don't already exist for this
// (lineItemId, year, month), leave the rest untouched. Same resulting rows,
// same values, one round trip instead of N.
export async function ensureMonthGenerated(householdId: string, year: number, month: number) {
  const lineItems = await prisma.monthlyLineItem.findMany({
    where: { householdId, isActive: true },
  });

  const applicable = lineItems.filter(
    (li) => li.repeatMonths.length === 0 || li.repeatMonths.includes(month)
  );
  if (applicable.length === 0) return;

  await prisma.monthlyEntry.createMany({
    data: applicable.map((li) => ({
      householdId,
      categoryId: li.categoryId,
      lineItemId: li.id,
      year,
      month,
      name: li.name,
      baseAmount: li.baseAmount,
      plannedAmount: li.baseAmount, // starting point; user can edit independently from here
    })),
    skipDuplicates: true,
  });
}
