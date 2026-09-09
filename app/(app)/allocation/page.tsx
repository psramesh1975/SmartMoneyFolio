import { redirect } from "next/navigation";
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
    <section className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Target allocation</h1>
      <p className="mt-2 text-base text-ink-2">
        Set the percentage of your total wealth you'd like in each asset
        class. The dashboard compares this against what you actually hold.
      </p>

      <AllocationClient
        assetClasses={ASSET_CLASSES.map((c) => ({ value: c.value, label: c.label }))}
        initialTargets={targetMap}
        canEdit={session.role !== "VIEWER"}
      />
    </section>
  );
}
