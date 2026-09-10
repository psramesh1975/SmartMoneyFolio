import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AssetsClient from "@/components/AssetsClient";

export default async function AssetsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const [household, familyMembers, accounts] = await Promise.all([
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { baseCurrency: true },
    }),
    prisma.familyMember.findMany({
      where: { householdId: session.householdId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.account.findMany({
      where: { householdId: session.householdId },
      include: { familyMember: { select: { id: true, name: true } }, security: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!household) redirect("/login");

  return (
    <section className="max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Assets</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Every fixed deposit, fund, bond, and account your household holds —
        grouped by category, with live valuations where a market price is
        available.
      </p>

      <AssetsClient
        familyMembers={familyMembers}
        baseCurrency={household.baseCurrency}
        initialAssets={accounts.map((a) => ({
          id: a.id,
          familyMemberId: a.familyMemberId,
          familyMemberName: a.familyMember.name,
          assetClass: a.assetClass,
          holdingName: a.holdingName,
          currency: a.currency,
          currentValue: a.currentValue.toString(),
          purchaseValue: a.purchaseValue?.toString() ?? null,
          accountOrFolioNo: a.accountOrFolioNo,
          securityId: a.securityId,
          securityName: a.security?.name ?? null,
          securityTickerOrCode: a.security?.tickerOrCode ?? null,
          securityLastPrice: a.security?.lastPrice?.toString() ?? null,
          unitsHeld: a.unitsHeld?.toString() ?? null,
          avgBuyPrice: a.avgBuyPrice?.toString() ?? null,
          interestRatePct: a.interestRatePct?.toString() ?? null,
          startDate: a.startDate?.toISOString() ?? null,
          maturityDate: a.maturityDate?.toISOString() ?? null,
          compoundingFrequency: a.compoundingFrequency,
          autoRenewalType: a.autoRenewalType,
          isTaxExempt: a.isTaxExempt,
          sipMonthlyAmount: a.sipMonthlyAmount?.toString() ?? null,
        }))}
      />
    </section>
  );
}
