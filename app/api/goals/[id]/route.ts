import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  targetAmount: z.coerce.number().positive().optional(),
  currency: z.enum(CURRENCY_CODES).optional(),
  currentAmount: z.coerce.number().nonnegative().optional(),
  targetDate: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const existing = await prisma.goal.findFirst({ where: { id, householdId: session.householdId } });
  if (!existing) return NextResponse.json({ error: "Goal not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Some details are invalid." }, { status: 400 });

  const { targetDate, ...rest } = parsed.data;
  const goal = await prisma.goal.update({
    where: { id },
    data: { ...rest, ...(targetDate !== undefined ? { targetDate: targetDate ? new Date(targetDate) : null } : {}) },
  });
  return NextResponse.json({ goal });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const existing = await prisma.goal.findFirst({ where: { id, householdId: session.householdId } });
  if (!existing) return NextResponse.json({ error: "Goal not found." }, { status: 404 });

  await prisma.goal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
