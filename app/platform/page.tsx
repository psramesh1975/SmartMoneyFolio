import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PlatformClientsClient from "@/components/PlatformClientsClient";
import LogoutButton from "@/components/LogoutButton";

export default async function PlatformPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformOwner) redirect("/dashboard");

  const households = await prisma.household.findMany({
    include: {
      users: { select: { id: true, email: true, role: true, status: true } },
      _count: { select: { familyMembers: true, accounts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-lg italic text-ink">
            WealthBridge
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-2xl text-ink">Clients</h1>
        <p className="mt-2 text-sm text-ink-2">
          Every client household on the platform. Suspend a client's access
          or adjust a user's role.
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
    </main>
  );
}
