/**
 * One-time cleanup for the race condition described in
 * lib/monthly-auto-sync.ts's getOrCreateSystemCategory(): concurrent
 * requests for the same household could each pass a check-then-create
 * check before any of them finished, producing duplicate MonthlyCategory
 * rows with the same (householdId, name, type) — typically "Loan EMIs" and
 * "Investments & SIPs", but the same race could in principle hit any
 * category name.
 *
 * NOT wired into package.json's build/seed scripts — run explicitly:
 *   npx tsx scripts/dedupe-monthly-categories.ts --dry-run   (read-only count)
 *   npx tsx scripts/dedupe-monthly-categories.ts             (merge + delete)
 * (mirrors the existing "never wire seed/cleanup scripts into the deploy
 * pipeline" convention already followed by scripts/seed-securities.ts.)
 *
 * Run --dry-run first — ideally against production — to see the actual
 * blast radius (how many real client households, not just the seeded test
 * tenant, are affected) before touching anything. It only reads.
 *
 * This MUST be run, and the database left duplicate-free, before applying
 * the schema change that adds `@@unique([householdId, name, type])` to
 * MonthlyCategory (prisma/schema.prisma) — the constraint fails to apply
 * while duplicates still exist.
 *
 * For each duplicate group, the row with the earliest createdAt is kept as
 * canonical; every MonthlyLineItem and MonthlyEntry pointing at a duplicate
 * is reassigned onto the canonical row, and the now-empty duplicate rows
 * are deleted. Each household's fix runs in a single transaction, so a
 * partial failure can't leave a line item pointing at a deleted category.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

type CategoryRow = {
  id: string;
  householdId: string;
  name: string;
  type: string;
  createdAt: Date;
};

function groupKey(c: Pick<CategoryRow, "householdId" | "name" | "type">): string {
  return `${c.householdId} ${c.name} ${c.type}`;
}

async function main() {
  const categories = await prisma.monthlyCategory.findMany({
    select: { id: true, householdId: true, name: true, type: true, createdAt: true },
    orderBy: { createdAt: "asc" }, // first row per group is the canonical one
  });

  const groups = new Map<string, CategoryRow[]>();
  for (const c of categories) {
    const key = groupKey(c);
    const arr = groups.get(key);
    if (arr) arr.push(c);
    else groups.set(key, [c]);
  }

  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  const affectedHouseholds = new Set(dupGroups.map((g) => g[0].householdId));
  const redundantRowCount = dupGroups.reduce((sum, g) => sum + g.length - 1, 0);

  if (dupGroups.length === 0) {
    console.log("No duplicate (householdId, name, type) groups found. Nothing to do.");
    return;
  }

  console.log(
    `Found ${dupGroups.length} duplicate category group(s) across ${affectedHouseholds.size} household(s), ` +
      `${redundantRowCount} redundant row(s) total.`
  );
  for (const group of dupGroups) {
    const [canonical, ...dupes] = group;
    console.log(
      `  [${canonical.householdId}] "${canonical.name}" (${canonical.type}): ` +
        `keep ${canonical.id}, merge ${dupes.map((d) => d.id).join(", ")}`
    );
  }

  if (DRY_RUN) {
    console.log("\nDry run only — no changes made. Rerun without --dry-run to merge and delete.");
    return;
  }

  // Group duplicate groups by household so each household's fix commits
  // (or rolls back) as one transaction.
  const groupsByHousehold = new Map<string, CategoryRow[][]>();
  for (const group of dupGroups) {
    const householdId = group[0].householdId;
    const arr = groupsByHousehold.get(householdId);
    if (arr) arr.push(group);
    else groupsByHousehold.set(householdId, [group]);
  }

  let householdsFixed = 0;
  let rowsMerged = 0;

  for (const [householdId, groupsForHousehold] of groupsByHousehold) {
    await prisma.$transaction(async (tx) => {
      for (const group of groupsForHousehold) {
        const [canonical, ...dupes] = group;
        const dupeIds = dupes.map((d) => d.id);

        await tx.monthlyLineItem.updateMany({
          where: { categoryId: { in: dupeIds } },
          data: { categoryId: canonical.id },
        });
        await tx.monthlyEntry.updateMany({
          where: { categoryId: { in: dupeIds } },
          data: { categoryId: canonical.id },
        });
        await tx.monthlyCategory.deleteMany({ where: { id: { in: dupeIds } } });

        rowsMerged += dupeIds.length;
      }
    });
    householdsFixed++;
    console.log(`Merged household ${householdId}: ${groupsForHousehold.length} group(s).`);
  }

  console.log(`\nDone. ${householdsFixed} household(s) affected, ${rowsMerged} duplicate row(s) merged and removed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
