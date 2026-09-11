/**
 * One-time cleanup for the race condition in lib/monthly-auto-sync.ts's
 * (now-fixed) reconcileAutoLinkedLineItems(): concurrent calls for the same
 * household could each read the same stale "no line item linked to this
 * liability/account yet" snapshot and each create their own row, producing
 * duplicate MonthlyLineItem rows for the same liability or account — which
 * then double- (or N-) count that EMI/SIP amount in Total Monthly Base
 * Outflow. Companion to scripts/dedupe-monthly-categories.ts, which fixed
 * the sibling race on MonthlyCategory.
 *
 * NOT wired into package.json's build/seed scripts — run explicitly:
 *   npx tsx scripts/dedupe-monthly-line-items.ts --dry-run   (read-only count)
 *   npx tsx scripts/dedupe-monthly-line-items.ts             (merge + delete)
 * (mirrors the existing "never wire seed/cleanup scripts into the deploy
 * pipeline" convention already followed by scripts/seed-securities.ts.)
 *
 * Run --dry-run first — ideally against production — to see the actual
 * blast radius before touching anything. It only reads.
 *
 * This MUST be run, and the database left duplicate-free, before applying
 * the schema change that adds `@@unique([householdId, liabilityId])` and
 * `@@unique([householdId, accountId])` to MonthlyLineItem
 * (prisma/schema.prisma) — the constraints fail to apply while duplicates
 * still exist.
 *
 * For each duplicate group (same householdId + liabilityId, or same
 * householdId + accountId), the row with the earliest createdAt is kept as
 * canonical. Every MonthlyEntry pointing at a duplicate is reassigned onto
 * the canonical row — except where the canonical already has an entry for
 * that same (year, month), which MonthlyEntry's own
 * @@unique([lineItemId, year, month]) constraint would reject; for that
 * colliding pair, the canonical's own entry is kept and the duplicate's
 * entry is deleted instead of reassigned. The now-empty duplicate
 * MonthlyLineItem rows are deleted last. Each household's cleanup runs in
 * a single transaction, so a partial failure can't leave an entry pointing
 * at a deleted line item.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

type LineItemRow = {
  id: string;
  householdId: string;
  liabilityId: string | null;
  accountId: string | null;
  createdAt: Date;
};

function groupKey(li: Pick<LineItemRow, "householdId" | "liabilityId" | "accountId">): string | null {
  if (li.liabilityId) return `L ${li.householdId} ${li.liabilityId}`;
  if (li.accountId) return `A ${li.householdId} ${li.accountId}`;
  return null; // manually created line items — never grouped, never touched
}

async function main() {
  const lineItems = await prisma.monthlyLineItem.findMany({
    where: { OR: [{ liabilityId: { not: null } }, { accountId: { not: null } }] },
    select: { id: true, householdId: true, liabilityId: true, accountId: true, createdAt: true },
    orderBy: { createdAt: "asc" }, // first row per group is the canonical one
  });

  const groups = new Map<string, LineItemRow[]>();
  for (const li of lineItems) {
    const key = groupKey(li);
    if (!key) continue;
    const arr = groups.get(key);
    if (arr) arr.push(li);
    else groups.set(key, [li]);
  }

  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  const affectedHouseholds = new Set(dupGroups.map((g) => g[0].householdId));
  const redundantRowCount = dupGroups.reduce((sum, g) => sum + g.length - 1, 0);

  if (dupGroups.length === 0) {
    console.log("No duplicate (householdId, liabilityId/accountId) groups found. Nothing to do.");
    return;
  }

  console.log(
    `Found ${dupGroups.length} duplicate line-item group(s) across ${affectedHouseholds.size} household(s), ` +
      `${redundantRowCount} redundant row(s) total.`
  );
  for (const group of dupGroups) {
    const [canonical, ...dupes] = group;
    const linkedTo = canonical.liabilityId ? `liability ${canonical.liabilityId}` : `account ${canonical.accountId}`;
    console.log(`  [${canonical.householdId}] ${linkedTo}: keep ${canonical.id}, merge ${dupes.map((d) => d.id).join(", ")}`);
  }

  if (DRY_RUN) {
    console.log("\nDry run only — no changes made. Rerun without --dry-run to merge and delete.");
    return;
  }

  const groupsByHousehold = new Map<string, LineItemRow[][]>();
  for (const group of dupGroups) {
    const householdId = group[0].householdId;
    const arr = groupsByHousehold.get(householdId);
    if (arr) arr.push(group);
    else groupsByHousehold.set(householdId, [group]);
  }

  let householdsFixed = 0;
  let rowsMerged = 0;
  let entriesReassigned = 0;
  let entriesDroppedForCollision = 0;

  for (const [householdId, groupsForHousehold] of groupsByHousehold) {
    await prisma.$transaction(async (tx) => {
      for (const group of groupsForHousehold) {
        const [canonical, ...dupes] = group;
        const dupeIds = dupes.map((d) => d.id);

        const [canonicalEntries, dupeEntries] = await Promise.all([
          tx.monthlyEntry.findMany({ where: { lineItemId: canonical.id }, select: { year: true, month: true } }),
          tx.monthlyEntry.findMany({ where: { lineItemId: { in: dupeIds } } }),
        ]);
        const canonicalPeriods = new Set(canonicalEntries.map((e) => `${e.year}-${e.month}`));

        for (const entry of dupeEntries) {
          if (canonicalPeriods.has(`${entry.year}-${entry.month}`)) {
            // Canonical already has an entry for this month — reassigning
            // would violate @@unique([lineItemId, year, month]). Keep the
            // canonical's own entry, drop this duplicate one.
            await tx.monthlyEntry.delete({ where: { id: entry.id } });
            entriesDroppedForCollision++;
          } else {
            await tx.monthlyEntry.update({ where: { id: entry.id }, data: { lineItemId: canonical.id } });
            canonicalPeriods.add(`${entry.year}-${entry.month}`); // guard against dupes-of-dupes colliding with each other
            entriesReassigned++;
          }
        }

        await tx.monthlyLineItem.deleteMany({ where: { id: { in: dupeIds } } });
        rowsMerged += dupeIds.length;
      }
    });
    householdsFixed++;
    console.log(`Merged household ${householdId}: ${groupsForHousehold.length} group(s).`);
  }

  console.log(
    `\nDone. ${householdsFixed} household(s) affected, ${rowsMerged} duplicate row(s) merged and removed, ` +
      `${entriesReassigned} entry(ies) reassigned, ${entriesDroppedForCollision} entry(ies) dropped for a year/month collision.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
