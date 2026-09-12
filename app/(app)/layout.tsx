import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ClientSidebar from "@/components/ClientSidebar";
import AppHeader from "@/components/AppHeader";
import { SectionThemeInit } from "@/components/SectionThemeInit";
import { MobileNavProvider } from "@/components/MobileNavContext";
import {
  getPreviousPeriod,
  getCurrentPeriod,
  getNextPeriod,
  getEarlierMonthsOfCurrentYear,
  getMostRecentArchivedYear,
  MONTH_LABELS_SHORT,
} from "@/lib/monthly-periods";
import { getPrimaryGoal, getLatestPriceSyncAt } from "@/lib/dashboard-data";
import { getMarketTicker } from "@/lib/market-ticker";
import { formatINRCompact } from "@/lib/format-indian-currency";
import { getDraftMonths } from "@/lib/tracking-data";
import { version as appVersion } from "@/package.json";

function periodLabel({ year, month }: { year: number; month: number }) {
  return `${MONTH_LABELS_SHORT[month - 1]} ${year}`;
}

// "Jan – Jul 2026", or just "Jul 2026" when there's only the one month —
// null (dropping the sidebar's trailing label entirely) when there are none
// yet, same "no data yet" case /monthly/earlier itself shows.
function earlierMonthsRangeLabel(periods: { year: number; month: number }[]): string | null {
  if (periods.length === 0) return null;
  const first = periods[0];
  const last = periods[periods.length - 1];
  if (first.month === last.month && first.year === last.year) {
    return periodLabel(first);
  }
  return `${MONTH_LABELS_SHORT[first.month - 1]} – ${periodLabel(last)}`;
}

// "2023 – 2025", or a single "2025" — null when nothing's archived yet.
function earlierYearsRangeLabel(years: number[]): string | null {
  if (years.length === 0) return null;
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min} – ${max}`;
}

// Compact target label for the sidebar's "Goals (... Target)" nav item —
// INR gets the mockup's "₹6 Cr" style; other currencies (this app is
// multi-currency) fall back to a plain rounded-crore-less figure since
// formatINRCompact's Lakh/Crore grouping is INR-specific.
function goalTargetLabel(goal: { targetAmount: number; currency: string } | null): string | null {
  if (!goal) return null;
  if (goal.currency === "INR") return formatINRCompact(goal.targetAmount);
  return `${goal.currency} ${Math.round(goal.targetAmount).toLocaleString()}`;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) {
    redirect(session.isPlatformOwner ? "/platform" : "/login");
  }

  const [household, familyMembers, primaryGoal, marketTicker, lastUpdatedAt] = await Promise.all([
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { name: true, timeZone: true, baseCurrency: true },
    }),
    prisma.familyMember.findMany({
      where: { householdId: session.householdId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, relationship: true },
    }),
    getPrimaryGoal(session.householdId),
    getMarketTicker(),
    getLatestPriceSyncAt(),
  ]);
  const timeZone = household?.timeZone || "UTC";
  const archivedYearCutoff = getMostRecentArchivedYear(timeZone);
  const [draftMonths, archivedYearRows] = await Promise.all([
    getDraftMonths(session.householdId, timeZone),
    // Same query /monthly/years itself runs — every year this household
    // actually has entries for, at or before the most recently archived
    // year, so the sidebar's range label only ever reflects real data.
    prisma.monthlyEntry.findMany({
      where: { householdId: session.householdId, year: { lte: archivedYearCutoff } },
      select: { year: true },
      distinct: ["year"],
    }),
  ]);

  return (
    <MobileNavProvider>
      <div className="flex min-h-screen bg-slate-50 dark:bg-canvas">
        <SectionThemeInit defaultTheme="light" />
        <ClientSidebar
          isPlatformOwner={session.isPlatformOwner}
          householdName={household?.name ?? ""}
          previousLabel={periodLabel(getPreviousPeriod(timeZone))}
          currentLabel={periodLabel(getCurrentPeriod(timeZone))}
          nextLabel={periodLabel(getNextPeriod(timeZone))}
          goalTargetLabel={goalTargetLabel(primaryGoal)}
          baseCurrency={household?.baseCurrency ?? "USD"}
          draftMonths={draftMonths}
          nextPeriod={getNextPeriod(timeZone)}
          earlierMonthsRangeLabel={earlierMonthsRangeLabel(getEarlierMonthsOfCurrentYear(timeZone))}
          earlierYearsRangeLabel={earlierYearsRangeLabel(archivedYearRows.map((r) => r.year))}
          appVersion={appVersion}
        />
        {/* min-w-0 overrides the flex item default of min-width: auto (sized
            to content's intrinsic width) — without it, wide unwrappable
            content (e.g. the Liabilities KPI cards) prevents this flex item
            from shrinking below that width, pushing the whole page wider
            than the viewport at narrow widths. This was always latent here;
            it only surfaced once the sidebar stopped taking up its own
            fixed width at <768px and stopped being the first thing a click
            landed on instead. */}
        <main className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            baseCurrency={household?.baseCurrency ?? "USD"}
            familyMembers={familyMembers}
            marketTicker={marketTicker}
            lastUpdatedAt={lastUpdatedAt}
          />
          {/* pt dropped (was py-10): every page's own top-level <section>
              already carries its own py-10, so this used to stack two lots
              of top padding under the header. Harmless before, but the
              header grew a second row (the market ticker strip) for the
              dashboard mockup, and the doubled gap became visually obvious
              underneath it. pb-10 is kept since no page supplies its own
              bottom padding beyond its section's. */}
          <div className="px-8 pb-10">{children}</div>
        </main>
      </div>
    </MobileNavProvider>
  );
}
