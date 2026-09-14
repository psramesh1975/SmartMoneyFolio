import { redirect } from "next/navigation";
import { Users2, CreditCard, Globe2, Zap } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SUBSCRIPTION_LABELS: Record<string, string> = {
  FREE: "Free",
  TRIAL: "Trial",
  PAID: "Paid",
};

const RENEWAL_WINDOWS = [
  { days: 7, label: "Due in 7 Days", tone: "rose", note: "Urgent renewal" },
  { days: 14, label: "Due in 14 Days", tone: "amber", note: "Automated reminder" },
  { days: 21, label: "Due in 21 Days", tone: "blue", note: "Notice scheduled" },
  { days: 30, label: "Due in 30 Days", tone: "indigo", note: "Standard cycle" },
] as const;

const TONE_CLASSES: Record<string, string> = {
  rose: "bg-rose-500/10 border-rose-500/20 text-rose-400",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
};

export default async function PlatformDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformOwner) redirect("/dashboard");

  const dbStart = Date.now();
  const households = await prisma.household.findMany({
    select: {
      id: true,
      createdAt: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      familyMembers: {
        where: { relationship: "Self" },
        select: { city: true },
        take: 1,
      },
    },
  });
  const dbLatencyMs = Date.now() - dbStart;

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const totalClients = households.length;
  const newLast7Days = households.filter((h) => now - h.createdAt.getTime() <= 7 * DAY_MS).length;
  const newLast30Days = households.filter((h) => now - h.createdAt.getTime() <= 30 * DAY_MS).length;

  const locationCounts = new Map<string, number>();
  for (const h of households) {
    const city = h.familyMembers[0]?.city?.trim() || "Unspecified";
    locationCounts.set(city, (locationCounts.get(city) ?? 0) + 1);
  }
  const topLocations = [...locationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const subscriptionCounts = new Map<string, number>();
  for (const h of households) {
    subscriptionCounts.set(h.subscriptionStatus, (subscriptionCounts.get(h.subscriptionStatus) ?? 0) + 1);
  }
  const subscriptionBreakdown = [...subscriptionCounts.entries()].sort((a, b) => b[1] - a[1]);
  const paidCount = households.filter((h) => h.subscriptionStatus === "PAID").length;
  const paidPct = totalClients > 0 ? Math.round((paidCount / totalClients) * 100) : 0;

  const renewalCounts = RENEWAL_WINDOWS.map(({ days, ...rest }) => {
    const cutoff = now + days * DAY_MS;
    const count = households.filter(
      (h) =>
        h.subscriptionStatus !== "FREE" &&
        h.subscriptionExpiresAt &&
        h.subscriptionExpiresAt.getTime() <= cutoff &&
        h.subscriptionExpiresAt.getTime() >= now
    ).length;
    return { days, count, ...rest };
  });
  const anyPaidOrTrial = households.some((h) => h.subscriptionStatus !== "FREE");

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      {/* Top action header */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">System Operations Console</h1>
          <p className="mt-0.5 text-xs text-slate-400">Platform telemetry, client accounts, and subscription tiers</p>
        </div>
        <span className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Live: <strong className="text-white">{totalClients} Active Households</strong>
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-canvas-card p-5 shadow-sm">
          <div className="flex items-start justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Total Households</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Users2 className="h-4 w-4" strokeWidth={2} />
            </span>
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-white">{totalClients}</p>
          <p className="mt-1 text-xs font-semibold text-emerald-400">
            +{newLast7Days} last 7d · +{newLast30Days} last 30d
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-canvas-card p-5 shadow-sm">
          <div className="flex items-start justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Subscription Ratio</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <CreditCard className="h-4 w-4" strokeWidth={2} />
            </span>
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-white">
            {paidPct}% <span className="text-xs font-normal text-slate-400">Paid</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${paidPct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            {totalClients - paidCount} Free/Trial ({paidCount} Paid Active)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-canvas-card p-5 shadow-sm">
          <div className="flex items-start justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Primary Geography</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
              <Globe2 className="h-4 w-4" strokeWidth={2} />
            </span>
          </div>
          <p className="mt-2 truncate font-mono text-2xl font-extrabold text-white">
            {topLocations[0] ? `${topLocations[0][0]} (${topLocations[0][1]})` : "—"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">
            {topLocations.length === 0
              ? "No clients yet"
              : topLocations
                  .slice(1)
                  .map(([city, count]) => `${city} (${count})`)
                  .join(" • ")}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-canvas-card p-5 shadow-sm">
          <div className="flex items-start justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Neon Database Latency</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Zap className="h-4 w-4" strokeWidth={2} />
            </span>
          </div>
          <p
            className={`mt-2 font-mono text-3xl font-extrabold ${dbLatencyMs < 500 ? "text-emerald-400" : "text-amber-400"}`}
          >
            {dbLatencyMs}ms
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {dbLatencyMs < 500 ? "Vercel Edge Connection Normal" : "Higher than usual — worth a look"}
          </p>
        </div>
      </div>

      {/* Subscription renewal queue */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-canvas-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Subscription Expiry Queue</h2>
            <p className="mt-0.5 text-xs text-slate-400">Upcoming trial and paid tier expirations</p>
          </div>
          {!anyPaidOrTrial && (
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
              All accounts on Free Tier
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {renewalCounts.map(({ days, count, label, note, tone }) => (
            <div key={days} className={`rounded-xl border p-3.5 ${TONE_CLASSES[tone]}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
              <p className="mt-1 font-mono text-xl font-black text-white">{count}</p>
              <p className="text-[10px] opacity-70">{note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regional breakdown + subscription status list */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-canvas-card p-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Clients by Geography</h2>
            <span className="font-mono text-xs text-slate-500">{totalClients} Registered</span>
          </div>
          {topLocations.length === 0 ? (
            <p className="text-sm text-slate-400">No clients yet.</p>
          ) : (
            <div className="space-y-3 pt-1 text-xs">
              {topLocations.map(([city, count]) => {
                const pct = totalClients > 0 ? Math.round((count / totalClients) * 100) : 0;
                return (
                  <div key={city}>
                    <div className="mb-1 flex justify-between">
                      <span className="font-medium text-slate-300">{city}</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {pct}% ({count})
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-800 bg-canvas-card p-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Free vs. Subscription</h2>
            <span className="font-mono text-xs text-slate-500">{totalClients} Registered</span>
          </div>
          {subscriptionBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400">No clients yet.</p>
          ) : (
            <div className="divide-y divide-slate-800 text-sm">
              {subscriptionBreakdown.map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-1.5">
                  <span className="text-white">{SUBSCRIPTION_LABELS[status] ?? status}</span>
                  <span className="text-slate-400">
                    {count}
                    {totalClients > 0 && (
                      <span className="ml-1 text-xs">({Math.round((count / totalClients) * 100)}%)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
