import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Read-only lookup against the global (household-independent) securities
// directory — still gated behind a session, same as every other route in
// this app, even though the rows themselves aren't household-scoped data.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const type = req.nextUrl.searchParams.get("type"); // "MUTUAL_FUND" | "STOCK" | null

  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const results = await prisma.securitiesMaster.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
      ...(type ? { securityType: type as "MUTUAL_FUND" | "STOCK" | "ETF" } : {}),
    },
    select: { id: true, tickerOrCode: true, name: true, exchange: true, lastPrice: true, securityType: true },
    take: 10,
  });

  return NextResponse.json({ results });
}
