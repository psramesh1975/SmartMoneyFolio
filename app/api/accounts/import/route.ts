import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AssetClass } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";
import { ASSET_CLASS_VALUES } from "@/lib/asset-classes";

const rowSchema = z.object({
  familyMemberId: z.string().min(1),
  assetClass: z.enum(ASSET_CLASS_VALUES),
  holdingName: z.string().min(1),
  currency: z.enum(CURRENCY_CODES),
  currentValue: z.coerce.number().nonnegative(),
});

const bodySchema = z.object({
  mode: z.enum(["append", "replace"]),
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
  const { mode, rows } = parsed.data;

  // Never trust that ids echoed back by the client are still valid — re-check
  // every family member actually belongs to this household before writing.
  const memberIds = [...new Set(rows.map((r) => r.familyMemberId))];
  const validMembers = await prisma.familyMember.findMany({
    where: { householdId, id: { in: memberIds } },
    select: { id: true },
  });
  const validMemberIds = new Set(validMembers.map((m) => m.id));
  if (rows.some((r) => !validMemberIds.has(r.familyMemberId))) {
    return NextResponse.json(
      { error: "One or more family members are no longer valid. Re-validate the file and try again." },
      { status: 400 }
    );
  }

  try {
    const items = await prisma.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.account.deleteMany({ where: { householdId } });
      }
      const created = [];
      for (const r of rows) {
        const account = await tx.account.create({
          data: {
            householdId,
            familyMemberId: r.familyMemberId,
            assetClass: r.assetClass as AssetClass,
            holdingName: r.holdingName,
            currency: r.currency,
            currentValue: r.currentValue,
          },
          include: { familyMember: { select: { id: true, name: true } } },
        });
        created.push(account);
      }
      return created;
    });

    return NextResponse.json({
      count: items.length,
      items: items.map((a) => ({
        id: a.id,
        familyMemberId: a.familyMemberId,
        familyMemberName: a.familyMember.name,
        assetClass: a.assetClass,
        holdingName: a.holdingName,
        currency: a.currency,
        currentValue: a.currentValue.toString(),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "The import failed and no changes were made. Try again." },
      { status: 500 }
    );
  }
}
