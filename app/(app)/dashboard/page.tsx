import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SolvencyKPIRow from "@/components/SolvencyKPIRow";
import UpcomingDebitsCard from "@/components/dashboard/UpcomingDebitsCard";
import GoalVelocityCard from "@/components/dashboard/GoalVelocityCard";
import EmergencyRunwayCard from "@/components/dashboard/EmergencyRunwayCard";
import { assetClassLabel, ASSET_GROUPS } from "@/lib/asset-classes";
import { formatCurrency } from "@/lib/format-currency";
import { getDashboardHeadlineKPIs, getUpcomingAutoDebits, getPrimaryGoal } from "@/lib/dashboard-data";

// Pure decoration — cycles a small fixed palette per card index so family
// member avatars stay visually distinct. No data behind this beyond the
// member's own name initial.
const avatarPalette = [
  { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200/60 dark:border-emerald-500/20" },
  { bg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", border: "border-purple-200/60 dark:border-purple-500/20" },
  { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200/60 dark:border-blue-500/20" },
  { bg: "bg-pink-50 dark:bg-pink-500/10", text: "text-pink-700 dark:text-pink-400", border: "border-pink-200/60 dark:border-pink-500/20" },
];

// Fixed color per ASSET_GROUPS label for the Macro Allocation segmented bar
// + legend — same 6 groups the (now-retired) dashboard AssetsOverview used,
// reused rather than inventing a third asset-categorization scheme
// alongside lib/asset-classes.ts's ASSET_GROUPS and lib/asset-categories.ts's
// 7-category /assets accordion (that one's final per the Phase 9 spec).
const macroGroupColor: Record<string, string> = {
  "Liquid Cash & Banking": "bg-blue-500 dark:bg-lime-400",
  "Market Investments": "bg-emerald-500 dark:bg-cyan-400",
  "Fixed Capital & Guaranteed": "bg-indigo-500",
  "Retirement & Locked Funds": "bg-amber-500",
  "Physical Assets / Real Estate": "bg-purple-500",
  Other: "bg-slate-400",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) {
    redirect(session.isPlatformOwner ? "/platform" : "/login");
  }

  const [household, headlineKpis, upcomingDebits, primaryGoal] = await Promise.all([
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

  // Macro Allocation — base-currency accounts only, grouped the same way the
  // dashboard's asset view always has (ASSET_GROUPS), rolled up into one
  // segmented bar + legend rather than the old expandable per-group tables.
  const macroGroups = ASSET_GROUPS.map((group) => ({
    label: group.label,
    total: accountRows
      .filter((a) => a.currency === baseCurrency && (group.classes as string[]).includes(a.assetClass))
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
          <SolvencyKPIRow kpis={headlineKpis} />

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
            {/* By family member — bento grid */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">By family member</h2>
                <Link href="/assets" className="text-sm text-blue-600 hover:underline dark:text-lime-400">
                  Manage assets →
                </Link>
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {memberBreakdowns.map((m, i) => {
                  const palette = avatarPalette[i % avatarPalette.length];
                  const sharePct = netWorth > 0 ? Math.round((m.total / netWorth) * 100 * 10) / 10 : null;
                  return (
                    <div key={m.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${palette.bg} ${palette.text} ${palette.border}`}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{m.name}</p>
                            {sharePct !== null && (
                              <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-lime-400/10 dark:text-lime-400">
                                {sharePct}%
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              {m.relationship}
                            </span>
                            {m.residencyStatus === "NRI" && (
                              <span className="rounded-full bg-amber-600/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
                                NRI
                              </span>
                            )}
                            {m.isMinor && (
                              <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-lime-400/10 dark:text-lime-400">
                                Minor
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {sharePct !== null && (
                        <div className="mt-3 h-1.5 overflow-hidden rounded bg-slate-100 dark:bg-white/5">
                          <div className="h-full bg-blue-600 dark:bg-lime-400" style={{ width: `${sharePct}%` }} />
                        </div>
                      )}

                      {Object.keys(m.byClass).length === 0 && m.otherCurrencyHoldings.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No assets added yet.</p>
                      ) : (
                        <table className="mt-3 w-full text-xs">
                          <tbody>
                            {Object.entries(m.byClass).map(([cls, value]) => (
                              <tr key={cls}>
                                <td className="py-0.5 text-slate-500 dark:text-slate-400">{assetClassLabel(cls)}</td>
                                <td className="py-0.5 text-right text-slate-900 dark:text-white">
                                  {formatCurrency(value, baseCurrency)}
                                </td>
                              </tr>
                            ))}
                            {m.otherCurrencyHoldings.map((h, i) => (
                              <tr key={`other-${i}`}>
                                <td className="py-0.5 text-slate-500 dark:text-slate-400">
                                  {h.holdingName} <span className="text-slate-500 dark:text-slate-400">({h.currency})</span>
                                </td>
                                <td className="py-0.5 text-right text-slate-500 dark:text-slate-400">
                                  {formatCurrency(h.value, h.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {m.total > 0 && (
                        <div className="mt-2 flex justify-between border-t border-slate-200/80 pt-2 text-sm dark:border-slate-800">
                          <span className="font-medium text-slate-900 dark:text-white">Total ({baseCurrency})</span>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {formatCurrency(m.total, baseCurrency)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Macro Allocation — what we own */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">What we own</h2>
                <Link href="/assets" className="text-sm text-blue-600 hover:underline dark:text-lime-400">
                  Manage assets →
                </Link>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
                {macroGroups.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No assets added yet.</p>
                ) : (
                  <>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                      {macroGroups.map((g) => (
                        <div
                          key={g.label}
                          className={macroGroupColor[g.label] ?? "bg-slate-400"}
                          style={{ width: `${(g.total / macroTotal) * 100}%` }}
                          title={`${g.label}: ${formatCurrency(g.total, baseCurrency)}`}
                        />
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                      {macroGroups.map((g) => (
                        <div key={g.label} className="flex items-center gap-2 text-xs">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${macroGroupColor[g.label] ?? "bg-slate-400"}`} />
                          <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-400">{g.label}</span>
                          <span className="shrink-0 font-medium text-slate-900 dark:text-white">
                            {Math.round((g.total / macroTotal) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Operational Context Rail */}
          <div className="space-y-6 lg:col-span-4">
            <UpcomingDebitsCard debits={upcomingDebits} baseCurrency={baseCurrency} />
            <GoalVelocityCard goal={primaryGoal} />
            <EmergencyRunwayCard financialRunway={headlineKpis.financialRunway} />
          </div>
        </div>
      </div>
    </section>
  );
}
