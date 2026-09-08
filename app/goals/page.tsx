import { redirect } from "next/navigation";
import Link from "next/link";
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
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-display text-lg italic text-ink">
            WealthBridge
          </Link>
          <Link href="/dashboard" className="text-sm text-ink-2 hover:text-span">
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl text-ink">Goals &amp; milestones</h1>
        <p className="mt-2 text-sm text-ink-2">
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
          }))}
          canEdit={session.role !== "VIEWER"}
        />
      </section>
    </main>
  );
}
