import { redirect } from "next/navigation";
import Link from "next/link";
import { Landmark, CreditCard, Scale, Gauge } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AllocationDonut from "@/components/AllocationDonut";
import AssetsOverview from "@/components/AssetsOverview";
import DebtOverview from "@/components/DebtOverview";
import DebtPayoffTimeline from "@/components/DebtPayoffTimeline";
import { assetClassLabel, ASSET_CLASSES } from "@/lib/asset-classes";
import { getSolvencySnapshot } from "@/lib/dashboard-data";
import { projectDebtPayoffTimeline } from "@/lib/amortization";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

// Pure decoration — cycles a small fixed palette per card index so family
// member avatars stay visually distinct. No data behind this beyond the
// member's own name initial.
const avatarPalette = [
  { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200/60 dark:border-emerald-500/20" },
  { bg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", border: "border-purple-200/60 dark:border-purple-500/20" },
  { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200/60 dark:border-blue-500/20" },
  { bg: "bg-pink-50 dark:bg-pink-500/10", text: "text-pink-700 dark:text-pink-400", border: "border-pink-200/60 dark:border-pink-500/20" },
];

// Cosmetic health cue only, not a stored rule.
function ratioTone(ratio: number) {
  if (ratio < 20) return "text-emerald-600 dark:text-cyan-400";
  if (ratio < 40) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) {
    redirect(session.isPlatformOwner ? "/platform" : "/login");
  }

  const [household, liabilitiesRaw, snapshot] = await Promise.all([
    prisma.household.findUnique({
      where: { id: session.householdId },
      include: {
        familyMembers: {
          orderBy: { createdAt: "asc" },
          include: { accounts: true },
        },
        allocationTargets: true,
      },
    }),
    prisma.liability.findMany({
      where: { householdId: session.householdId },
      include: { familyMember: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getSolvencySnapshot(session.householdId),
  ]);

  if (!household) redirect("/login");

  const baseCurrency = household.baseCurrency;

  // Only accounts in the household's base currency count toward net worth
  // and allocation percentages, since there's no FX conversion yet — mixing
  // currencies into one total would be misleading rather than useful.
  let netWorth = 0;
  const byClassTotals: Record<string, number> = {};
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
        byClassTotals[acc.assetClass] = (byClassTotals[acc.assetClass] ?? 0) + value;
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

  const targetMap: Record<string, number> = {};
  for (const t of household.allocationTargets) targetMap[t.assetClass] = Number(t.targetPercent) * 100;

  const classesWithData = ASSET_CLASSES.filter(
    (c) => (byClassTotals[c.value] ?? 0) > 0 || (targetMap[c.value] ?? 0) > 0
  );
  const allocationLabels = classesWithData.map((c) => c.label);
  const allocationActual = classesWithData.map((c) =>
    netWorth > 0 ? Math.round(((byClassTotals[c.value] ?? 0) / netWorth) * 100) : 0
  );
  const allocationTarget = classesWithData.map((c) => Math.round(targetMap[c.value] ?? 0));

  const liabilityRows = liabilitiesRaw.map((l) => ({
    id: l.id,
    familyMemberName: l.familyMember.name,
    liabilityType: l.liabilityType,
    name: l.name,
    currency: l.currency,
    outstandingBalance: l.outstandingBalance.toString(),
    originalAmount: l.originalAmount?.toString() ?? null,
    interestRate: l.interestRate?.toString() ?? null,
    emiAmount: l.emiAmount?.toString() ?? null,
    targetPayoffDate: l.targetPayoffDate?.toISOString() ?? null,
  }));

  // Debt Payoff Timeline: base-currency liabilities only, same convention
  // as the rest of the totals.
  const payoffPoints = projectDebtPayoffTimeline(
    liabilitiesRaw
      .filter((l) => l.currency === baseCurrency)
      .map((l) => ({
        outstandingBalance: Number(l.outstandingBalance),
        interestRate: l.interestRate ? Number(l.interestRate) : null,
        emiAmount: l.emiAmount ? Number(l.emiAmount) : null,
      }))
  );

  return (
    <section className="max-w-5xl px-6 py-10">
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

        {/* 6a. Solvency Snapshot */}
        <div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total assets
                </span>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-emerald-600 dark:border-cyan-500/20 dark:bg-emerald-500/10 dark:text-cyan-400">
                  <Landmark size={16} />
                </div>
              </div>
              <p className="mt-1 text-2xl font-black tracking-tight text-emerald-600 dark:text-cyan-400">
                {snapshot.baseCurrency} {fmt(snapshot.totalAssets)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total liabilities
                </span>
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-2 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-400">
                  <CreditCard size={16} />
                </div>
              </div>
              <p className="mt-1 text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
                {snapshot.baseCurrency} {fmt(snapshot.totalLiabilities)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Net worth
                </span>
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-2 text-blue-600 dark:border-lime-400/20 dark:bg-blue-500/10 dark:text-lime-400">
                  <Scale size={16} />
                </div>
              </div>
              <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {snapshot.baseCurrency} {fmt(snapshot.netWorth)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total assets − total liabilities</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Debt-to-asset ratio
                </span>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-2 text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <Gauge size={16} />
                </div>
              </div>
              <p className={`mt-1 text-2xl font-black tracking-tight ${ratioTone(snapshot.debtToAssetRatio)}`}>
                {snapshot.debtToAssetRatio.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* 6b. Assets — What We Own */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Assets — what we own</h2>
            <Link href="/accounts" className="text-sm text-blue-600 hover:underline dark:text-lime-400">
              Manage assets →
            </Link>
          </div>

          {otherCurrencyCount.count > 0 && (
            <p className="mt-3 border border-slate-200/80 bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-white/5 dark:text-slate-400">
              {otherCurrencyCount.count} asset{otherCurrencyCount.count > 1 ? "s are" : " is"} in a
              currency other than {baseCurrency} and {otherCurrencyCount.count > 1 ? "aren't" : "isn't"}{" "}
              included in the totals above yet — currency conversion isn't built in this module.
            </p>
          )}

          {accountRows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No assets added yet.</p>
          ) : (
            <div className="mt-4">
              <AssetsOverview
                accounts={accountRows}
                familyMembers={household.familyMembers.map((m) => ({ id: m.id, name: m.name }))}
                baseCurrency={baseCurrency}
              />
            </div>
          )}

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
                  {Object.keys(m.byClass).length === 0 && m.otherCurrencyHoldings.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No assets added yet.</p>
                  ) : (
                    <table className="mt-3 w-full text-xs">
                      <tbody>
                        {Object.entries(m.byClass).map(([cls, value]) => (
                          <tr key={cls}>
                            <td className="py-0.5 text-slate-500 dark:text-slate-400">{assetClassLabel(cls)}</td>
                            <td className="py-0.5 text-right text-slate-900 dark:text-white">{fmt(value)}</td>
                          </tr>
                        ))}
                        {m.otherCurrencyHoldings.map((h, i) => (
                          <tr key={`other-${i}`}>
                            <td className="py-0.5 text-slate-500 dark:text-slate-400">
                              {h.holdingName} <span className="text-slate-500 dark:text-slate-400">({h.currency})</span>
                            </td>
                            <td className="py-0.5 text-right text-slate-500 dark:text-slate-400">{fmt(h.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {m.total > 0 && (
                    <div className="mt-2 flex justify-between border-t border-slate-200/80 pt-2 text-sm dark:border-slate-800">
                      <span className="font-medium text-slate-900 dark:text-white">Total ({baseCurrency})</span>
                      <span className="font-medium text-slate-900 dark:text-white">{fmt(m.total)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 6c. Debt & Liabilities — What We Owe */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Debt &amp; liabilities — what we owe</h2>
            <Link href="/liabilities" className="text-sm text-blue-600 hover:underline dark:text-lime-400">
              Manage liabilities →
            </Link>
          </div>
          <div className="mt-4">
            <DebtOverview liabilities={liabilityRows} baseCurrency={baseCurrency} />
          </div>
        </div>

        {/* 6d. Visuals */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Asset allocation</h2>
            {classesWithData.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Add assets and set a target allocation to see this chart.
              </p>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
                <AllocationDonut labels={allocationLabels} actual={allocationActual} target={allocationTarget} />
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Debt payoff timeline</h2>
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
              <DebtPayoffTimeline points={payoffPoints} currency={baseCurrency} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
