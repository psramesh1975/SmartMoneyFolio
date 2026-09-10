import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMonthPayload, getHouseholdTimeZone } from "@/lib/monthly-data";
import { getNextPeriod, MONTH_LABELS } from "@/lib/monthly-periods";
import MonthlyTrackerClient from "@/components/MonthlyTrackerClient";

export default async function NextMonthPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const timeZone = await getHouseholdTimeZone(session.householdId);
  const { year, month } = getNextPeriod(timeZone);
  const [payload, household] = await Promise.all([
    getMonthPayload(session.householdId, year, month),
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { baseCurrency: true },
    }),
  ]);

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
        Next Month — {MONTH_LABELS[month - 1]} {year}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Get ahead — line item changes you make now land here first.
      </p>

      <MonthlyTrackerClient
        initialPayload={payload}
        currency={household?.baseCurrency ?? "USD"}
        period="next"
      />
    </section>
  );
}
