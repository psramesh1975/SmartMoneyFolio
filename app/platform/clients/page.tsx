import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PlatformClientsClient from "@/components/PlatformClientsClient";

export default async function PlatformClientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformOwner) redirect("/dashboard");

  const households = await prisma.household.findMany({
    include: {
      users: { select: { id: true, email: true, status: true } },
      familyMembers: { where: { relationship: "Self" }, select: { city: true }, take: 1 },
      _count: { select: { familyMembers: true, accounts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Client Households</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Every client household on the platform. Suspend, reactivate, or permanently remove a client below.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Manual tenant creation is not scoped yet — households are created via self-signup."
          className="cursor-not-allowed rounded-xl bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-500"
        >
          + Add Client / Tenant
        </button>
      </div>

      <PlatformClientsClient
        initialHouseholds={households.map((h) => ({
          id: h.id,
          name: h.name,
          baseCurrency: h.baseCurrency,
          city: h.familyMembers[0]?.city?.trim() || "Unspecified",
          subscriptionStatus: h.subscriptionStatus,
          createdAt: h.createdAt.toISOString(),
          isSuspended: h.isSuspended,
          familyMemberCount: h._count.familyMembers,
          accountCount: h._count.accounts,
          users: h.users,
        }))}
      />
    </section>
  );
}
