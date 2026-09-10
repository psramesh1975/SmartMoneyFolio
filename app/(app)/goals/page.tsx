import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import GoalsClient from "@/components/GoalsClient";

export default async function GoalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const goals = await prisma.goal.findMany({
    where: { householdId: session.householdId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Goals &amp; milestones</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Track progress toward named targets — a retirement corpus, a
        child's education fund, or anything else with a number attached.
      </p>

      <GoalsClient
        initialGoals={goals.map((g) => ({
          id: g.id,
          name: g.name,
          targetAmount: g.targetAmount.toString(),
          currentAmount: g.currentAmount.toString(),
          currency: g.currency,
          targetDate: g.targetDate ? g.targetDate.toISOString() : null,
        }))}
      />
    </section>
  );
}
