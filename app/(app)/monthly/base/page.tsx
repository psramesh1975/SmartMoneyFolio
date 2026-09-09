import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBasePayload } from "@/lib/monthly-data";
import MonthlyBaseClient from "@/components/MonthlyBaseClient";

export default async function MonthlyBasePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const [categories, household] = await Promise.all([
    getBasePayload(session.householdId),
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { baseCurrency: true },
    }),
  ]);

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Monthly Base</h1>
      <p className="mt-2 text-base text-ink-2">
        Set up categories and recurring lines once — home loan, school fees, SIPs, rent,
        subscriptions — with their steady Base amount, in {household?.baseCurrency ?? "USD"}. This
        is the template months are generated from; it holds no Planned or Actual figures itself.
      </p>

      <MonthlyBaseClient initialCategories={categories} />
    </section>
  );
}
