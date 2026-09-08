import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";

const createSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.coerce.number().positive(),
  currency: z.enum(CURRENCY_CODES),
  currentAmount: z.coerce.number().nonnegative().default(0),
  targetDate: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const goals = await prisma.goal.findMany({
    where: { householdId: session.householdId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });
  if (session.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers can't add goals." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Some details are missing or invalid." }, { status: 400 });
  }

  const goal = await prisma.goal.create({
    data: {
      householdId: session.householdId,
      name: parsed.data.name,
      targetAmount: parsed.data.targetAmount,
      currency: parsed.data.currency,
      currentAmount: parsed.data.currentAmount,
      targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
    },
  });

  return NextResponse.json({ goal });
}
