import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchLatestPrice, fetchLatestNav } from "@/lib/price-providers";

// Plain authenticated endpoint, callable by any scheduler (Vercel Cron
// today, a different host's cron, or a free service like cron-job.org,
// later) — nothing Vercel-specific here.
export async function POST(req: NextRequest) {
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
    }
  }

  return NextResponse.json({ synced: linkedSecurities.length, updated });
}
