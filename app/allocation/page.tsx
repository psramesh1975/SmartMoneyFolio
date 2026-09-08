import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AllocationClient from "@/components/AllocationClient";
import { ASSET_CLASSES } from "@/lib/asset-classes";

export default async function AllocationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const targets = await prisma.allocationTarget.findMany({
    where: { householdId: session.householdId },
  });

  const targetMap: Record<string, number> = {};
  for (const t of targets) targetMap[t.assetClass] = Number(t.targetPercent) * 100;

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
        <h1 className="font-display text-2xl text-ink">Target allocation</h1>
        <p className="mt-2 text-sm text-ink-2">
          Set the percentage of your total wealth you'd like in each asset
          class. The dashboard compares this against what you actually hold.
        </p>

        <AllocationClient
          assetClasses={ASSET_CLASSES.map((c) => ({ value: c.value, label: c.label }))}
          initialTargets={targetMap}
          canEdit={session.role !== "VIEWER"}
        />
      </section>
    </main>
  );
}
