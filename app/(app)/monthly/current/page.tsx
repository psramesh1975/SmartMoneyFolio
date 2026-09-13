import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMonthPayload, getHouseholdTimeZone } from "@/lib/monthly-data";
import { getCurrentPeriod, MONTH_LABELS } from "@/lib/monthly-periods";
import { getTableTheme } from "@/lib/table-themes";
import MonthlyTrackerClient from "@/components/MonthlyTrackerClient";
import TableThemeProvider from "@/components/TableThemeProvider";
import TableThemeSwitcher from "@/components/TableThemeSwitcher";

export default async function CurrentMonthPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const timeZone = await getHouseholdTimeZone(session.householdId);
  const { year, month } = getCurrentPeriod(timeZone);
  const [payload, household] = await Promise.all([
    getMonthPayload(session.householdId, year, month),
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { baseCurrency: true, tableTheme: true },
    }),
  ]);

  return (
    <section className="max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Current Month — {MONTH_LABELS[month - 1]} {year}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Fully editable. Recurring lines were snapshotted in automatically —
            edit a line's plan for next month, or fill in what actually happened
            this month.
          </p>
        </div>
        <TableThemeSwitcher currentTheme={household?.tableTheme ?? "orange"} />
      </div>

      <TableThemeProvider theme={getTableTheme(household?.tableTheme ?? "orange")}>
        <MonthlyTrackerClient
          initialPayload={payload}
          currency={household?.baseCurrency ?? "USD"}
          period="current"
        />
      </TableThemeProvider>
    </section>
  );
}
