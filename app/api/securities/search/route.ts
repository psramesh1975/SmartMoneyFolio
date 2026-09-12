import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

type SearchRow = {
  id: string;
  tickerOrCode: string;
  name: string;
  exchange: string | null;
  lastPrice: string | null;
  securityType: string;
};

// Read-only lookup against the global (household-independent) securities
// directory — still gated behind a session, same as every other route in
// this app, even though the rows themselves aren't household-scoped data.
//
// Uses Postgres full-text search (search_vector, a generated tsvector
// column with a GIN index — see prisma/sql/add_securities_fulltext_search.sql)
// rather than a plain ILIKE substring match. plainto_tsquery tolerates
// multi-word queries and word order; ts_rank sorts the best name/ticker
// matches first instead of returning in arbitrary row order. Prisma can't
// build tsvector/tsquery predicates through its query builder, so this uses
// prisma.$queryRaw via Prisma.sql, splicing in the optional type filter as
// Prisma.empty when absent (a plain-string interpolation attempt here
// wouldn't compose the way nested $queryRaw calls suggest).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const type = req.nextUrl.searchParams.get("type"); // "MUTUAL_FUND" | "STOCK" | null

  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const typeClause =
    type != null ? Prisma.sql`AND "securityType" = ${type}::"SecurityType"` : Prisma.empty;

  const results = await prisma.$queryRaw<SearchRow[]>(Prisma.sql`
    SELECT id, "tickerOrCode", name, exchange, "lastPrice"::text as "lastPrice", "securityType"
    FROM securities_master
    WHERE search_vector @@ plainto_tsquery('simple', ${q})
      ${typeClause}
    ORDER BY ts_rank(search_vector, plainto_tsquery('simple', ${q})) DESC
    LIMIT 10
  `);

  return NextResponse.json({ results });
}
