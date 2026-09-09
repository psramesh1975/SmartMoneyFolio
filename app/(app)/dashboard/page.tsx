import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AllocationChart from "@/components/AllocationChart";
import { assetClassLabel, ASSET_CLASSES } from "@/lib/asset-classes";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) {
    redirect(session.isPlatformOwner ? "/platform" : "/login");
  }

  const household = await prisma.household.findUnique({
    where: { id: session.householdId },
    include: {
      familyMembers: {
        orderBy: { createdAt: "asc" },
        include: { accounts: true },
      },
      users: { select: { id: true, email: true, role: true } },
      allocationTargets: true,
      goals: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!household) redirect("/login");

  const baseCurrency = household.baseCurrency;

  // Only accounts in the household's base currency count toward net worth
  // and allocation percentages, since there's no FX conversion yet — mixing
  // currencies into one total would be misleading rather than useful.
  let netWorth = 0;
  const byClassTotals: Record<string, number> = {};
  const otherCurrencyCount = { count: 0 };

  const memberBreakdowns = household.familyMembers.map((member) => {
    const byClass: Record<string, number> = {};
    let memberTotal = 0;
    const otherCurrencyHoldings: { holdingName: string; currency: string; value: number }[] = [];

    for (const acc of member.accounts) {
      const value = Number(acc.currentValue);
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

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
            Total net worth
          </p>
          <p className="mt-1 font-display text-3xl text-growth">
            {baseCurrency} {fmt(netWorth)}
          </p>
        </div>
        <div className="border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
            Base currency
          </p>
          <p className="mt-1 font-display text-3xl text-ink">{household.baseCurrency}</p>
        </div>
        <div className="border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
            Operational currency
          </p>
          <p className="mt-1 font-display text-3xl text-amber">{household.operationalCurrency}</p>
        </div>
        <div className="border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
            Goals tracked
          </p>
          <p className="mt-1 font-display text-3xl text-ink">{household.goals.length}</p>
        </div>
      </div>

      {otherCurrencyCount.count > 0 && (
        <p className="mt-4 border border-line bg-paper-2 px-4 py-2 text-sm text-ink-2">
          {otherCurrencyCount.count} holding{otherCurrencyCount.count > 1 ? "s are" : " is"} in a
          currency other than {baseCurrency} and {otherCurrencyCount.count > 1 ? "aren't" : "isn't"}{" "}
          included in the total above yet — currency conversion isn't built in this module.
        </p>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">By family member</h2>
          <Link href="/accounts" className="text-base text-folio hover:underline">
            Manage holdings →
          </Link>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {memberBreakdowns.map((m) => (
            <div key={m.id} className="border border-line bg-white p-4">
              <p className="mb-2 text-base font-medium text-ink">{m.name}</p>
              {Object.keys(m.byClass).length === 0 && m.otherCurrencyHoldings.length === 0 ? (
                <p className="text-sm text-ink-2">No holdings added yet.</p>
              ) : (
                <table className="w-full text-base">
                  <tbody>
                    {Object.entries(m.byClass).map(([cls, value]) => (
                      <tr key={cls}>
                        <td className="py-0.5 text-ink-2">{assetClassLabel(cls)}</td>
                        <td className="py-0.5 text-right text-ink">{fmt(value)}</td>
                      </tr>
                    ))}
                    {m.otherCurrencyHoldings.map((h, i) => (
                      <tr key={`other-${i}`}>
                        <td className="py-0.5 text-ink-2">
                          {h.holdingName} <span className="text-ink-2">({h.currency})</span>
                        </td>
                        <td className="py-0.5 text-right text-ink-2">{fmt(h.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {m.total > 0 && (
                <div className="mt-2 flex justify-between border-t border-line pt-2 text-base">
                  <span className="font-medium text-ink">Total ({baseCurrency})</span>
                  <span className="font-medium text-ink">{fmt(m.total)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">Allocation: actual vs target</h2>
          <Link href="/allocation" className="text-base text-folio hover:underline">
            Set targets →
          </Link>
        </div>
        {classesWithData.length === 0 ? (
          <p className="mt-3 text-base text-ink-2">
            Add holdings and set a target allocation to see this chart.
          </p>
        ) : (
          <div className="mt-4 border border-line bg-white p-4">
            <AllocationChart labels={allocationLabels} actual={allocationActual} target={allocationTarget} />
          </div>
        )}
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">Goals</h2>
          <Link href="/goals" className="text-base text-folio hover:underline">
            Manage goals →
          </Link>
        </div>
        {household.goals.length === 0 ? (
          <p className="mt-3 text-base text-ink-2">No goals added yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {household.goals.map((g) => {
              const target = Number(g.targetAmount) || 1;
              const current = Number(g.currentAmount) || 0;
              const pct = Math.min(100, Math.round((current / target) * 100));
              return (
                <div key={g.id} className="border border-line bg-white p-4">
                  <div className="flex items-center justify-between text-base">
                    <span className="font-medium text-ink">{g.name}</span>
                    <span className="text-ink-2">
                      {g.currency} {fmt(current)} of {fmt(target)} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded bg-paper-2">
                    <div className="h-full bg-folio" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="font-display text-2xl text-ink">People with access</h2>
        <div className="mt-4 divide-y divide-line border border-line bg-white">
          {household.users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3">
              <p className="text-base text-ink">{u.email}</p>
              <span className="text-xs uppercase tracking-wide text-folio">{u.role}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-10 border border-line bg-paper-2 px-4 py-3 text-base text-ink-2">
        Cash flow tracking (the monthly and yearly planner screens) is coming
        in the next update.
      </p>
    </section>
  );
}
