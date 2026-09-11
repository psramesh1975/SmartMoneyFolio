import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchLatestPrice, fetchLatestNav } from "@/lib/price-providers";

// Plain authenticated endpoint, callable by any scheduler (Vercel Cron
// today, a different host's cron, or a free service like cron-job.org,
// later) — nothing Vercel-specific in the logic itself. Both GET and POST
// run the same sync: GET exists because Vercel Cron always invokes via GET
// (and conveniently sends this same Authorization: Bearer $CRON_SECRET
// header automatically when CRON_SECRET is set on the project — no extra
// config needed there); POST is kept for manual/external-scheduler calls.
async function handleSync(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only sync securities actually linked to a live household holding — no
  // point refreshing every master row daily.
  const linkedSecurities = await prisma.securitiesMaster.findMany({
    where: { accounts: { some: {} } },
  });

  let updated = 0;
  for (const sec of linkedSecurities) {
    const price =
      sec.securityType === "MUTUAL_FUND"
        ? await fetchLatestNav(sec.tickerOrCode)
        : await fetchLatestPrice(sec.tickerOrCode);

    if (price !== null) {
      await prisma.securitiesMaster.update({
        where: { id: sec.id },
        data: { lastPrice: price, priceUpdatedAt: new Date() },
      });
      updated++;

      // Keep every linked Account.currentValue in step with the fresh
      // price — this is what keeps the Dashboard's getSolvencySnapshot()
      // (which sums the stored currentValue column directly) in agreement
      // with what /assets computes live. Prisma's updateMany can't multiply
      // by each row's own unitsHeld in one call, so this is a small loop —
      // one household's holdings, not a performance concern.
      const linkedAccounts = await prisma.account.findMany({
        where: { securityId: sec.id, unitsHeld: { not: null } },
      });
      for (const acct of linkedAccounts) {
        await prisma.account.update({
          where: { id: acct.id },
          data: { currentValue: Number(acct.unitsHeld) * price },
        });
      }
    }
  }

  return NextResponse.json({ synced: linkedSecurities.length, updated });
}

export const GET = handleSync;
export const POST = handleSync;
