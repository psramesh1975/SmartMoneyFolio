import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFlatBasePayload } from "@/lib/monthly-data";
import { prisma } from "@/lib/db";
import MonthlyBaseReferenceClient from "@/components/MonthlyBaseReferenceClient";

export default async function MonthlyBasePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const [payload, household] = await Promise.all([
    getFlatBasePayload(session.householdId),
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { baseCurrency: true },
    }),
  ]);

  return (
    <section className="px-6 py-10">
      <MonthlyBaseReferenceClient payload={payload} baseCurrency={household?.baseCurrency ?? "USD"} />
    </section>
  );
}
