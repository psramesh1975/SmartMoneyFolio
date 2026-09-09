import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SUBSCRIPTION_LABELS: Record<string, string> = {
  FREE: "Free",
  TRIAL: "Trial",
  PAID: "Paid",
};

export default async function PlatformDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformOwner) redirect("/dashboard");

  const households = await prisma.household.findMany({
    select: {
      id: true,
      createdAt: true,
      subscriptionStatus: true,
      familyMembers: {
        where: { relationship: "Self" },
        select: { city: true },
        take: 1,
      },
    },
  });

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const totalClients = households.length;
  const newLast7Days = households.filter(
    (h) => now - h.createdAt.getTime() <= 7 * DAY_MS
  ).length;
  const newLast30Days = households.filter(
    (h) => now - h.createdAt.getTime() <= 30 * DAY_MS
  ).length;

  const locationCounts = new Map<string, number>();
  for (const h of households) {
    const city = h.familyMembers[0]?.city?.trim() || "Unspecified";
    locationCounts.set(city, (locationCounts.get(city) ?? 0) + 1);
  }
  const topLocations = [...locationCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const subscriptionCounts = new Map<string, number>();
  for (const h of households) {
    subscriptionCounts.set(
      h.subscriptionStatus,
      (subscriptionCounts.get(h.subscriptionStatus) ?? 0) + 1
    );
  }
  const subscriptionBreakdown = [...subscriptionCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl text-ink">Dashboard</h1>
      <p className="mt-2 text-base text-ink-2">
        A snapshot of the platform as a whole.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="border border-line bg-white p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-2">
            New signups
          </h2>
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-base text-ink-2">Last 7 days</span>
              <span className="text-2xl font-medium text-ink">{newLast7Days}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-base text-ink-2">Last 30 days</span>
              <span className="text-2xl font-medium text-ink">{newLast30Days}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-base text-ink-2">All time</span>
              <span className="text-2xl font-medium text-ink">{totalClients}</span>
            </div>
          </div>
        </div>

        <div className="border border-line bg-white p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-2">
            Clients by location
          </h2>
          {topLocations.length === 0 ? (
            <p className="mt-3 text-base text-ink-2">No clients yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-line">
              {topLocations.map(([city, count]) => (
                <div key={city} className="flex items-center justify-between py-1.5">
                  <span className="text-base text-ink">{city}</span>
                  <span className="text-base text-ink-2">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-line bg-white p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-2">
            Free vs. Subscription
          </h2>
          {subscriptionBreakdown.length === 0 ? (
            <p className="mt-3 text-base text-ink-2">No clients yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-line">
              {subscriptionBreakdown.map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-1.5">
                  <span className="text-base text-ink">
                    {SUBSCRIPTION_LABELS[status] ?? status}
                  </span>
                  <span className="text-base text-ink-2">
                    {count}
                    {totalClients > 0 && (
                      <span className="ml-1 text-sm text-ink-2">
                        ({Math.round((count / totalClients) * 100)}%)
                      </span>
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
