import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";

const rowSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.coerce.number().positive(),
  currency: z.enum(CURRENCY_CODES),
  currentAmount: z.coerce.number().nonnegative().default(0),
  targetDate: z.coerce.date().nullable().optional(),
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

  try {
    const items = await prisma.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.goal.deleteMany({ where: { householdId } });
      }
      const created = [];
      for (const r of rows) {
        const goal = await tx.goal.create({
          data: {
            householdId,
            name: r.name,
            targetAmount: r.targetAmount,
            currency: r.currency,
            currentAmount: r.currentAmount,
            targetDate: r.targetDate ?? null,
          },
        });
        created.push(goal);
      }
      return created;
    });

    return NextResponse.json({
      count: items.length,
      items: items.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount.toString(),
        currentAmount: g.currentAmount.toString(),
        currency: g.currency,
        targetDate: g.targetDate ? g.targetDate.toISOString() : null,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "The import failed and no changes were made. Try again." },
      { status: 500 }
    );
  }
}
