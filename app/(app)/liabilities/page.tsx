import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LiabilitiesClient from "@/components/LiabilitiesClient";

export default async function LiabilitiesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const [familyMembers, liabilities] = await Promise.all([
    prisma.familyMember.findMany({
      where: { householdId: session.householdId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.liability.findMany({
      where: { householdId: session.householdId },
      include: { familyMember: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <section className="max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Debts &amp; liabilities</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Track loans, mortgages, and running balances under the family member
        they belong to. These feed the dashboard's solvency snapshot and
        payoff timeline.
      </p>

      <LiabilitiesClient
        familyMembers={familyMembers}
        initialLiabilities={liabilities.map((l) => ({
          id: l.id,
          familyMemberId: l.familyMemberId,
          familyMemberName: l.familyMember.name,
          liabilityType: l.liabilityType,
          name: l.name,
          currency: l.currency,
          outstandingBalance: l.outstandingBalance.toString(),
          originalAmount: l.originalAmount?.toString() ?? null,
          interestRate: l.interestRate?.toString() ?? null,
          emiAmount: l.emiAmount?.toString() ?? null,
          targetPayoffDate: l.targetPayoffDate?.toISOString() ?? null,
        }))}
      />
    </section>
  );
}
