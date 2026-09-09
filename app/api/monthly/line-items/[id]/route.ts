import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const repeatMonthSchema = z.number().int().min(1).max(12);

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  baseAmount: z.coerce.number().positive().optional(),
  repeatMonths: z.array(repeatMonthSchema).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const lineItem = await prisma.monthlyLineItem.findFirst({
    where: { id, householdId: session.householdId },
  });
  if (!lineItem) return NextResponse.json({ error: "Line item not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Some details are missing or invalid." }, { status: 400 });
  }

  // Only affects entries not yet generated — existing MonthlyEntry rows for
  // months already snapshotted are never touched here.
  const updated = await prisma.monthlyLineItem.update({
    where: { id: lineItem.id },
    data: parsed.data,
  });

  return NextResponse.json({ lineItem: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const lineItem = await prisma.monthlyLineItem.findFirst({
    where: { id, householdId: session.householdId },
  });
  if (!lineItem) return NextResponse.json({ error: "Line item not found." }, { status: 404 });

  // Soft-stop rather than a hard delete, so existing entries keep their
  // lineItemId (and thus their edit history) instead of being orphaned.
  const updated = await prisma.monthlyLineItem.update({
    where: { id: lineItem.id },
    data: { isActive: false },
  });

  return NextResponse.json({ lineItem: updated });
}
