import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFlatBasePayload } from "@/lib/monthly-data";
import MonthlyBaseClient from "@/components/MonthlyBaseClient";

export default async function MonthlyBasePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const { lineItems, categories } = await getFlatBasePayload(session.householdId);

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <p className="mb-4 text-sm text-ink-2">
        Set up your recurring lines once — home loan, school fees, SIPs, rent, subscriptions —
        with their steady Base amount. No Planned or Actual here; that's the month, not the setup.
      </p>
      <MonthlyBaseClient initialLineItems={lineItems} initialCategories={categories} />
    </section>
  );
}
