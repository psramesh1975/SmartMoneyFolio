import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CURRENCY_CODES } from "@/lib/currencies";

const LIABILITY_TYPES = ["HOME_LOAN", "CAR_LOAN", "PERSONAL_LOAN", "CREDIT_CARD", "DEVICE_EMI", "OTHER"] as const;

const updateSchema = z.object({
  familyMemberId: z.string().min(1).optional(),
  liabilityType: z.enum(LIABILITY_TYPES).optional(),
  name: z.string().min(1).optional(),
  currency: z.enum(CURRENCY_CODES).optional(),
  outstandingBalance: z.coerce.number().nonnegative().optional(),
  originalAmount: z.coerce.number().nonnegative().optional(),
  interestRate: z.coerce.number().min(0).max(100).optional(),
  emiAmount: z.coerce.number().nonnegative().optional(),
  targetPayoffDate: z.coerce.date().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const existing = await prisma.liability.findFirst({ where: { id, householdId: session.householdId } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  const liability = await prisma.liability.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ liability });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const existing = await prisma.liability.findFirst({ where: { id, householdId: session.householdId } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.liability.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
