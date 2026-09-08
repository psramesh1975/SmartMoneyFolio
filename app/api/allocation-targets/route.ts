import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const ASSET_CLASSES = [
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

const bulkSchema = z.object({
  targets: z.array(
    z.object({
      assetClass: z.enum(ASSET_CLASSES),
      targetPercent: z.coerce.number().min(0).max(1),
    })
  ),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const targets = await prisma.allocationTarget.findMany({
    where: { householdId: session.householdId },
  });

  return NextResponse.json({ targets });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });
  if (session.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers can't change allocation targets." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Some values are missing or invalid." }, { status: 400 });
  }

  const householdId = session.householdId;

  await prisma.$transaction(
    parsed.data.targets.map((t) =>
      prisma.allocationTarget.upsert({
        where: {
          householdId_assetClass: {
            householdId,
            assetClass: t.assetClass,
          },
        },
        create: {
          householdId,
          assetClass: t.assetClass,
          targetPercent: t.targetPercent,
        },
        update: { targetPercent: t.targetPercent },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
