import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getMostRecentArchivedYear } from "@/lib/monthly-periods";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const archivedYear = getMostRecentArchivedYear();

  const rows = await prisma.monthlyEntry.findMany({
    where: { householdId: session.householdId, year: { lte: archivedYear } },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });

  return NextResponse.json({ years: rows.map((r) => r.year) });
}
