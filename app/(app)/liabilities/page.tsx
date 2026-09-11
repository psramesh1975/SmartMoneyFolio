import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDebtSnapshot } from "@/lib/dashboard-data";
import LiabilitiesClient from "@/components/LiabilitiesClient";

export default async function LiabilitiesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const [household, familyMembers, liabilities, debtSnapshot] = await Promise.all([
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { baseCurrency: true },
    }),
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
    getDebtSnapshot(session.householdId),
  ]);

  if (!household) redirect("/login");

  return (
    <section className="max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Debts &amp; liabilities</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Track loans, mortgages, and running balances under the family member
        they belong to. These feed the dashboard's solvency snapshot and
        payoff timeline.
      </p>

      <LiabilitiesClient
        familyMembers={familyMembers}
        baseCurrency={household.baseCurrency}
        debtSnapshot={debtSnapshot}
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
          accountReference: l.accountReference,
          isRevolving: l.isRevolving,
          statementDueDay: l.statementDueDay,
        }))}
      />
    </section>
  );
}
