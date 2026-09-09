import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AccountsClient from "@/components/AccountsClient";

export default async function AccountsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const [familyMembers, accounts] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId: session.householdId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.account.findMany({
      where: { householdId: session.householdId },
      include: { familyMember: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Investments &amp; savings</h1>
      <p className="mt-2 text-base text-ink-2">
        Add each holding — an FD, a mutual fund, a bank account — under the
        family member it belongs to. These feed the dashboard's breakdown
        and allocation chart.
      </p>

      <AccountsClient
        familyMembers={familyMembers}
        initialAccounts={accounts.map((a) => ({
          id: a.id,
          familyMemberId: a.familyMemberId,
          familyMemberName: a.familyMember.name,
          assetClass: a.assetClass,
          holdingName: a.holdingName,
          currency: a.currency,
          currentValue: a.currentValue.toString(),
        }))}
      />
    </section>
  );
}
