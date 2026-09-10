import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getReadOnlyMonthPayload, getHouseholdTimeZone } from "@/lib/monthly-data";
import { getEarlierMonthsOfCurrentYear } from "@/lib/monthly-periods";
import MonthlyHistoryStack from "@/components/MonthlyHistoryStack";

export default async function EarlierMonthsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const timeZone = await getHouseholdTimeZone(session.householdId);
  const periods = getEarlierMonthsOfCurrentYear(timeZone);

  const [months, household] = await Promise.all([
    Promise.all(periods.map((p) => getReadOnlyMonthPayload(session.householdId!, p.year, p.month))),
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { baseCurrency: true },
    }),
  ]);

  return (
    <section className="max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Earlier Months</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Read-only — this year's months before Previous Month.
      </p>

      {months.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">Nothing here yet this year.</p>
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
