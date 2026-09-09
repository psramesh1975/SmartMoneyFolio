import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getYearPayload, getHouseholdTimeZone } from "@/lib/monthly-data";
import { getMostRecentArchivedYear } from "@/lib/monthly-periods";
import MonthlyHistoryStack from "@/components/MonthlyHistoryStack";

export default async function ArchivedYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearStr } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const timeZone = await getHouseholdTimeZone(session.householdId);
  const year = Number(yearStr);
  if (!Number.isInteger(year) || year > getMostRecentArchivedYear(timeZone)) {
    redirect("/monthly/years");
  }

  const [{ months, yearlySummary }, household] = await Promise.all([
    getYearPayload(session.householdId, year),
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { baseCurrency: true },
    }),
  ]);
  const monthsWithData = months.filter((m) => m.categories.length > 0);

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">{year}</h1>
      <p className="mt-2 text-base text-ink-2">Read-only — fully archived.</p>

      {monthsWithData.length === 0 ? (
        <p className="mt-8 text-base text-ink-2">No entries recorded for {year}.</p>
      ) : (
        <div className="mt-8">
          <MonthlyHistoryStack
            months={[...monthsWithData].reverse()}
            yearlySummary={yearlySummary}
            currency={household?.baseCurrency ?? "USD"}
          />
        </div>
      )}
    </section>
  );
}
