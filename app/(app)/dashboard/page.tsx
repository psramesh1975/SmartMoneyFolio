import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SolvencyKPIRow from "@/components/SolvencyKPIRow";
import UpcomingDebitsCard from "@/components/dashboard/UpcomingDebitsCard";
import GoalVelocityCard from "@/components/dashboard/GoalVelocityCard";
import EmergencyRunwayCard from "@/components/dashboard/EmergencyRunwayCard";
import { assetClassLabel } from "@/lib/asset-classes";
import { formatCurrency } from "@/lib/format-currency";
import {
  getDashboardHeadlineKPIs,
  getUpcomingAutoDebits,
  getPrimaryGoal,
  getCurrentMonthLabel,
  getMonthlySipTotal,
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

// Macro Allocation's exact 4 buckets + colors, per the approved mockup —
// deliberately a THIRD asset categorization (distinct from
// lib/asset-classes.ts's ASSET_GROUPS, still used by AssetsClient.tsx's own
// grouped view on /assets, and lib/asset-categories.ts's 7-category /assets
// accordion, final per the Phase 9 spec). "Other" isn't in the mockup — it's
// a fallback for classes the mockup's 4 buckets don't name (SGB, Gold,
// Retirement, Insurance, Government Scheme, Real Estate, Crypto), so a
// household holding any of those doesn't have its total silently undercount
// what these 4 segments + legend show.
const MACRO_ALLOCATION_GROUPS: { label: string; classes: string[]; color: string }[] = [
  { label: "Fixed Deposits", classes: ["FIXED_DEPOSIT"], color: "bg-purple-600" },
  { label: "Equities & Stocks", classes: ["STOCKS"], color: "bg-blue-600" },
  { label: "Mutual Funds", classes: ["MUTUAL_FUNDS"], color: "bg-pink-500" },
  { label: "Liquid Cash & Bonds", classes: ["CASH", "BONDS"], color: "bg-amber-500" },
  {
    label: "Other",
    classes: ["SGB", "GOLD", "RETIREMENT_SAVINGS", "INSURANCE_LINKED", "GOVERNMENT_SCHEME", "REAL_ESTATE", "CRYPTOCURRENCY", "OTHER"],
    color: "bg-slate-400",
  },
];

// Abbreviated Indian numbering (Cr/Lakh) in the mockup is demo flavor for
// one currency; formatCurrency() is used instead throughout this page to
// stay consistent with the rest of this multi-currency app.
function formatMacroPercent(pct: number): string {
  if (pct > 0 && pct < 0.1) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) {
    redirect(session.isPlatformOwner ? "/platform" : "/login");
  }

  const [household, headlineKpis, upcomingDebits, primaryGoal, currentMonthLabel, monthlySipTotal] = await Promise.all([
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
    getUpcomingAutoDebits(session.householdId),
    getPrimaryGoal(session.householdId),
    getCurrentMonthLabel(session.householdId),
    getMonthlySipTotal(session.householdId),
  ]);

  if (!household) redirect("/login");

  const baseCurrency = household.baseCurrency;

  // Only accounts in the household's base currency count toward net worth,
  // since there's no FX conversion yet — mixing currencies into one total
  // would be misleading rather than useful.
  let netWorth = 0;
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

  // Macro Allocation — base-currency accounts only, grouped into the
  // mockup's 4 named buckets + an "Other" catch-all.
  const macroGroups = MACRO_ALLOCATION_GROUPS.map((group) => ({
    label: group.label,
    color: group.color,
    total: accountRows
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
            </h1>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Base {household.baseCurrency} · Operational {household.operationalCurrency}
            </span>
          </div>
        </div>

        {/* 1. Solvency Snapshot — full-width KPI strip */}
        <div>
          <SolvencyKPIRow kpis={headlineKpis} memberCount={household.familyMembers.length} />

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
                {memberBreakdowns.map((m, i) => {
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
                                {formatCurrency(value, baseCurrency)}
                              </span>
                            </div>
                          ))}
                          {m.otherCurrencyHoldings.map((h, i) => (
                            <div key={`other-${i}`} className="flex justify-between text-slate-400 dark:text-slate-500">
                              <span>
                                {h.holdingName} ({h.currency})
                              </span>
                              <span className="font-mono">{formatCurrency(h.value, h.currency)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-xs dark:border-slate-800/60">
                        <span className="font-semibold text-slate-400 dark:text-slate-500">Total</span>
                        <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                          {formatCurrency(m.total, baseCurrency)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Macro Allocation — what we own */}
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Macro Allocation: What We Own
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">Target vs. Actual</span>
              </div>

              {macroGroups.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">No assets added yet.</p>
              ) : (
                <>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                    {macroGroups.map((g) => (
                      <div
                        key={g.label}
                        className={g.color}
                        style={{ width: `${(g.total / macroTotal) * 100}%` }}
                        title={`${g.label}: ${formatMacroPercent((g.total / macroTotal) * 100)}`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 pt-1 text-xs font-semibold">
                    {macroGroups.map((g) => (
                      <span key={g.label} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <span className={`h-2.5 w-2.5 rounded-full ${g.color}`} />
                        {g.label}: {formatCurrency(g.total, baseCurrency)} (
                        {formatMacroPercent((g.total / macroTotal) * 100)})
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Operational Context Rail */}
          <div className="space-y-6 lg:col-span-4">
            <UpcomingDebitsCard debits={upcomingDebits} baseCurrency={baseCurrency} currentMonthLabel={currentMonthLabel} />
            <GoalVelocityCard goal={primaryGoal} monthlySipTotal={monthlySipTotal} />
            <EmergencyRunwayCard financialRunway={headlineKpis.financialRunway} />
          </div>
        </div>
      </div>
    </section>
  );
}
