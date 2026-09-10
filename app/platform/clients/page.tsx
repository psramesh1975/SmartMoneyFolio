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
      _count: { select: { familyMembers: true, accounts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Clients</h1>
      <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
        Every client household on the platform. Suspend or reactivate a
        client's access below.
      </p>

      <PlatformClientsClient
        initialHouseholds={households.map((h) => ({
          id: h.id,
          name: h.name,
          baseCurrency: h.baseCurrency,
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
