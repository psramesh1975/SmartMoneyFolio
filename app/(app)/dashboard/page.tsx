import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SolvencyKPIRow from "@/components/SolvencyKPIRow";
import UpcomingDebitsCard from "@/components/dashboard/UpcomingDebitsCard";
import EmergencyRunwayCard from "@/components/dashboard/EmergencyRunwayCard";
import AssetDistributionDonut from "@/components/dashboard/AssetDistributionDonut";
import GoalsProgressChart from "@/components/dashboard/GoalsProgressChart";
import LiabilitiesDonut from "@/components/dashboard/LiabilitiesDonut";
import IncomeOutflowTrendChart from "@/components/dashboard/IncomeOutflowTrendChart";
import MemberAllocationStackedBar from "@/components/dashboard/MemberAllocationStackedBar";
import CategoryBreakupDonut from "@/components/breakdown/CategoryBreakupDonut";
import { assetClassLabel } from "@/lib/asset-classes";
import { formatDashboardAmount } from "@/lib/dashboard-format";
import { MACRO_ALLOCATION_GROUPS } from "@/lib/dashboard-macro-groups";
import { getCurrentPeriod } from "@/lib/monthly-periods";
import { getMonthBreakdown } from "@/lib/monthly-breakdown";
import {
  getDashboardHeadlineKPIs,
  getUpcomingAutoDebits,
  getAllGoalsProgress,
  getLiabilitiesByType,
  getIncomeOutflowTrend,
  getCurrentMonthLabel,
} from "@/lib/dashboard-data";

// Pure decoration — cycles a small fixed palette per card index so family
// member avatars stay visually distinct. No data behind this beyond the
// member's own name initial. Colors and order match the approved mockup
// (gemini-code-1789190462523-.html) exactly; `bar` reuses the same color
// for that member's mini share-of-net-worth progress bar.
const avatarPalette = [
  { bg: "bg-purple-100 dark:bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", pill: "bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-400", bar: "bg-purple-600" },
  { bg: "bg-blue-100 dark:bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", pill: "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400", bar: "bg-blue-600" },
  { bg: "bg-pink-100 dark:bg-pink-500/10", text: "text-pink-700 dark:text-pink-400", pill: "bg-pink-100 text-pink-800 dark:bg-pink-500/10 dark:text-pink-400", bar: "bg-pink-500" },
  { bg: "bg-amber-100 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400", bar: "bg-amber-500" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) {
    redirect(session.isPlatformOwner ? "/platform" : "/login");
  }

  const { member: memberParam } = await searchParams;

  const [household, headlineKpisAll, currentMonthLabel, allGoalsProgress, incomeOutflowTrend] = await Promise.all([
    prisma.household.findUnique({
      where: { id: session.householdId },
      include: {
        familyMembers: {
          orderBy: { createdAt: "asc" },
          include: { accounts: true },
        },
      },
    }),
    getDashboardHeadlineKPIs(session.householdId),
    getCurrentMonthLabel(session.householdId),
    getAllGoalsProgress(session.householdId), // household-wide — Goal has no familyMemberId
    getIncomeOutflowTrend(session.householdId), // household-wide — Monthly Tracking entries have no familyMemberId
  ]);

  if (!household) redirect("/login");

  const baseCurrency = household.baseCurrency;

  // The "Household" dropdown in the header is really a family-member filter
  // (see components/dashboard/MemberFilterSelect.tsx) — validate the id
  // against this household's own members rather than trusting the query
  // string outright, falling back to "All Members" for anything else
  // (a stale id from another household, a typo, etc).
  const selectedMember = memberParam ? household.familyMembers.find((m) => m.id === memberParam) : undefined;
  const selectedMemberId = selectedMember?.id;

  // Current-month category spend, reusing the exact getMonthBreakdown() +
  // CategoryBreakupDonut combo already proven on the Monthly Tracker
  // breakdown panel. household.timeZone is already on hand from the fetch
  // above, so this doesn't need its own getHouseholdTimeZone() round trip.
  const { year: currentYear, month: currentMonth } = getCurrentPeriod(household.timeZone);

  const [headlineKpis, liabilitiesByType, upcomingDebitsAll, monthBreakdown] = await Promise.all([
    selectedMemberId ? getDashboardHeadlineKPIs(session.householdId, selectedMemberId) : Promise.resolve(headlineKpisAll),
    getLiabilitiesByType(session.householdId, selectedMemberId),
    getUpcomingAutoDebits(session.householdId, 15, selectedMemberId),
    getMonthBreakdown(session.householdId, currentYear, currentMonth, { periodKind: "current" }),
  ]);
  const upcomingDebits = upcomingDebitsAll;

  // Only accounts in the household's base currency count toward net worth,
  // since there's no FX conversion yet — mixing currencies into one total
  // would be misleading rather than useful.
  let netWorth = 0; // always household-wide — used as the %-share denominator below, even while filtered
  const otherCurrencyCount = { count: 0 };
  const accountRows: {
    id: string;
    familyMemberId: string;
    familyMemberName: string;
    assetClass: string;
    holdingName: string;
    currency: string;
    currentValue: string;
  }[] = [];

  const memberBreakdowns = household.familyMembers.map((member) => {
    const byClass: Record<string, number> = {};
    let memberTotal = 0;
    const otherCurrencyHoldings: { holdingName: string; currency: string; value: number }[] = [];

    for (const acc of member.accounts) {
      const value = Number(acc.currentValue);
      accountRows.push({
        id: acc.id,
        familyMemberId: member.id,
        familyMemberName: member.name,
        assetClass: acc.assetClass,
        holdingName: acc.holdingName,
        currency: acc.currency,
        currentValue: acc.currentValue.toString(),
      });
      if (acc.currency === baseCurrency) {
        byClass[acc.assetClass] = (byClass[acc.assetClass] ?? 0) + value;
        memberTotal += value;
        netWorth += value;
      } else {
        otherCurrencyHoldings.push({ holdingName: acc.holdingName, currency: acc.currency, value });
        otherCurrencyCount.count += 1;
      }
    }

    return {
      id: member.id,
      name: member.name,
      relationship: member.relationship,
      residencyStatus: member.residencyStatus,
      isMinor: member.isMinor,
      byClass,
      total: memberTotal,
      otherCurrencyHoldings,
    };
  });

  // "By family member" grid: shows every member when unfiltered (as before);
  // narrows to just the selected member's card when a filter is active.
  // Share % keeps dividing by the whole household's netWorth either way —
  // "this member holds X% of the household" stays meaningful even when
  // their card is the only one on screen.
  const visibleMemberBreakdowns = selectedMemberId
    ? memberBreakdowns.filter((m) => m.id === selectedMemberId)
    : memberBreakdowns;

  // Macro Allocation — base-currency accounts only, grouped into the
  // mockup's 4 named buckets + an "Other" catch-all. Scoped to the selected
  // member's own holdings when filtered.
  const macroSourceRows = selectedMemberId
    ? accountRows.filter((a) => a.familyMemberId === selectedMemberId)
    : accountRows;
  const macroGroups = MACRO_ALLOCATION_GROUPS.map((group) => ({
    label: group.label,
    color: group.color,
    total: macroSourceRows
      .filter((a) => a.currency === baseCurrency && group.classes.includes(a.assetClass))
      .reduce((sum, a) => sum + Number(a.currentValue), 0),
  })).filter((g) => g.total > 0);
  const macroTotal = macroGroups.reduce((sum, g) => sum + g.total, 0);

  return (
    <section className="max-w-6xl px-6 py-10">
      <div className="space-y-8">
        <div className="border-b border-slate-200/80 pb-6 dark:border-slate-800">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Wealth Overview</span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              {household.name}
              {selectedMember && (
                <span className="ml-2 text-sm font-semibold text-emerald-600 dark:text-cyan-400">
                  — {selectedMember.name}&rsquo;s view
                </span>
              )}
            </h1>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Base {household.baseCurrency} · Operational {household.operationalCurrency}
            </span>
          </div>
        </div>

        {/* 1. Solvency Snapshot — full-width KPI strip */}
        <div>
          <SolvencyKPIRow kpis={headlineKpis} memberCount={selectedMember ? 1 : household.familyMembers.length} />

          {otherCurrencyCount.count > 0 && (
            <p className="mt-4 border border-slate-200/80 bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-white/5 dark:text-slate-400">
              {otherCurrencyCount.count} asset{otherCurrencyCount.count > 1 ? "s are" : " is"} in a
              currency other than {baseCurrency} and {otherCurrencyCount.count > 1 ? "aren't" : "isn't"}{" "}
              included in the totals above yet — currency conversion isn't built in this module.
            </p>
          )}
        </div>

        {/* 2. Workspace (left, 8/12) + Operational Context Rail (right, 4/12) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {/* By family member — bento grid, wrapped in one outer card per the mockup */}
            <div className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800/60">
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">By family member</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ownership allocation &amp; distinct instruments across the household
                  </p>
                </div>
                <Link href="/assets" className="shrink-0 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-cyan-400 dark:hover:text-cyan-300">
                  Manage assets →
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {visibleMemberBreakdowns.map((m) => {
                  const i = memberBreakdowns.findIndex((x) => x.id === m.id);
                  const palette = avatarPalette[i % avatarPalette.length];
                  const sharePct = netWorth > 0 ? Math.round((m.total / netWorth) * 100 * 10) / 10 : null;
                  return (
                    <div key={m.id} className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-4 transition hover:border-slate-300 dark:border-slate-800/60 dark:bg-white/5 dark:hover:border-cyan-500/40">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${palette.bg} ${palette.text}`}>
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                              {m.name}{" "}
                              <span className="text-[10px] font-normal font-semibold text-slate-400 dark:text-slate-500">
                                ({m.relationship}
                                {m.isMinor ? " • Minor" : ""})
                              </span>
                            </p>
                            {m.residencyStatus === "NRI" && (
                              <span className="mt-0.5 inline-block rounded-full bg-amber-600/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
                                NRI
                              </span>
                            )}
                          </div>
                        </div>
                        {sharePct !== null && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${palette.pill}`}>
                            {sharePct}% Share
                          </span>
                        )}
                      </div>

                      {sharePct !== null && (
                        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                          <div className={`h-full rounded-full ${palette.bar}`} style={{ width: `${sharePct}%` }} />
                        </div>
                      )}

                      {Object.keys(m.byClass).length === 0 && m.otherCurrencyHoldings.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">No assets added yet.</p>
                      ) : (
                        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                          {Object.entries(m.byClass).map(([cls, value]) => (
                            <div key={cls} className="flex justify-between">
                              <span>{assetClassLabel(cls)}</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {formatDashboardAmount(value, baseCurrency)}
                              </span>
                            </div>
                          ))}
                          {m.otherCurrencyHoldings.map((h, i) => (
                            <div key={`other-${i}`} className="flex justify-between text-slate-400 dark:text-slate-500">
                              <span>
                                {h.holdingName} ({h.currency})
                              </span>
                              <span className="font-mono">{formatDashboardAmount(h.value, h.currency)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-xs dark:border-slate-800/60">
                        <span className="font-semibold text-slate-400 dark:text-slate-500">Total</span>
                        <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                          {formatDashboardAmount(m.total, baseCurrency)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Asset Allocation by Family Member — stacked bar, moved here (below
                the individual member cards) per product owner's requested order:
                KPI row → family member individual data → the six chart widgets. */}
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Asset Allocation by Family Member
                </h3>
              </div>
              <MemberAllocationStackedBar memberBreakdowns={visibleMemberBreakdowns} baseCurrency={baseCurrency} />
            </div>

            {/* Income vs Outflow — moved here (below family member data) per
                product owner's requested order; was previously full-width above
                the family member section. */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Income vs. Outflow (Last 6 Months)
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">Household-wide</span>
              </div>
              <IncomeOutflowTrendChart trend={incomeOutflowTrend} baseCurrency={baseCurrency} />
            </div>

            {/* Macro Allocation — what we own */}
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Macro Allocation: What We Own
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">Target vs. Actual</span>
              </div>

              <AssetDistributionDonut macroGroups={macroGroups} macroTotal={macroTotal} baseCurrency={baseCurrency} />
            </div>

            {/* Debt Composition — new, doesn't replace anything existing */}
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Debt Composition
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">By liability type</span>
              </div>

              <LiabilitiesDonut breakdown={liabilitiesByType} baseCurrency={baseCurrency} />
            </div>
          </div>

          {/* Operational Context Rail */}
          <div className="space-y-6 lg:col-span-4">
            <UpcomingDebitsCard debits={upcomingDebits} baseCurrency={baseCurrency} currentMonthLabel={currentMonthLabel} />

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Category Spend ({currentMonthLabel})
              </h4>
              <CategoryBreakupDonut
                categoryBreakup={monthBreakdown.categoryBreakup}
                totalSpend={monthBreakdown.totalSpend}
                currency={baseCurrency}
              />
            </div>

            <GoalsProgressChart goals={allGoalsProgress} householdWideNote={Boolean(selectedMember)} />
            <EmergencyRunwayCard financialRunway={headlineKpis.financialRunway} householdWideNote={Boolean(selectedMember)} />
          </div>
        </div>
      </div>
    </section>
  );
}
