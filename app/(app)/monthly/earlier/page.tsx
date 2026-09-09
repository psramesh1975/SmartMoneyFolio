import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getReadOnlyMonthPayload } from "@/lib/monthly-data";
import { getEarlierMonthsOfCurrentYear } from "@/lib/monthly-periods";
import MonthlyHistoryStack from "@/components/MonthlyHistoryStack";

export default async function EarlierMonthsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const periods = getEarlierMonthsOfCurrentYear();

  const [months, household] = await Promise.all([
    Promise.all(periods.map((p) => getReadOnlyMonthPayload(session.householdId!, p.year, p.month))),
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { baseCurrency: true },
    }),
  ]);

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Earlier Months</h1>
      <p className="mt-2 text-base text-ink-2">
        Read-only — this year's months before Previous Month.
      </p>

      {months.length === 0 ? (
        <p className="mt-8 text-base text-ink-2">Nothing here yet this year.</p>
      ) : (
        <div className="mt-8">
          <MonthlyHistoryStack
            months={[...months].reverse()}
            currency={household?.baseCurrency ?? "USD"}
          />
        </div>
      )}
    </section>
  );
}
