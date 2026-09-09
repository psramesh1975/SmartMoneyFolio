import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const ASSET_CLASS_VALUES = [
  "CASH",
  "FIXED_DEPOSIT",
  "STOCKS",
  "MUTUAL_FUNDS",
  "BONDS",
  "GOLD",
  "RETIREMENT_SAVINGS",
  "INSURANCE_LINKED",
  "REAL_ESTATE",
  "CRYPTOCURRENCY",
  "OTHER",
] as const;

const rowSchema = z.object({
  assetClass: z.enum(ASSET_CLASS_VALUES),
  targetPercent: z.coerce.number().min(0).max(1),
});

// AllocationTarget is one row per (householdId, assetClass), unique by
// constraint — append and replace both resolve to an upsert, so `mode` is
// accepted but not required (the client hides the mode choice for this
// importer entirely; see components/ImportExcelModal.tsx hideModeChoice).
const bodySchema = z.object({
  mode: z.enum(["append", "replace"]).optional(),
  rows: z.array(rowSchema).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "The import data is invalid or empty." }, { status: 400 });
  }

  const householdId = session.householdId;

  // Duplicate asset classes within the payload would silently overwrite
  // each other via upsert — validate already rejects these, but never trust
  // that the client actually enforced it.
  const seen = new Set<string>();
  for (const r of parsed.data.rows) {
    if (seen.has(r.assetClass)) {
      return NextResponse.json(
        { error: "The import data has duplicate asset classes. Re-validate the file and try again." },
        { status: 400 }
      );
    }
    seen.add(r.assetClass);
  }

  try {
    const results = await prisma.$transaction(
      parsed.data.rows.map((r) =>
        prisma.allocationTarget.upsert({
          where: { householdId_assetClass: { householdId, assetClass: r.assetClass } },
          create: { householdId, assetClass: r.assetClass, targetPercent: r.targetPercent },
          update: { targetPercent: r.targetPercent },
        })
      )
    );

    return NextResponse.json({
      count: results.length,
      targets: results.map((t) => ({
        assetClass: t.assetClass,
        targetPercent: Number(t.targetPercent),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "The import failed and no changes were made. Try again." },
      { status: 500 }
    );
  }
}
