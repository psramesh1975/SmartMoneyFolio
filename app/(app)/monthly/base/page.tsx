import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFlatBasePayload } from "@/lib/monthly-data";
import { prisma } from "@/lib/db";
import MonthlyBaseClient from "@/components/MonthlyBaseClient";

export default async function MonthlyBasePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const [payload, household] = await Promise.all([
    getFlatBasePayload(session.householdId),
    prisma.household.findUnique({ where: { id: session.householdId }, select: { baseCurrency: true } }),
  ]);

  return (
    <section className="max-w-4xl px-6 py-10">
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Debt EMIs and active SIPs sync in automatically from Liabilities and Assets — edit the amount
        there, not here. Add everything else below.
      </p>
      <MonthlyBaseClient payload={payload} baseCurrency={household?.baseCurrency ?? "USD"} />
    </section>
  );
}
