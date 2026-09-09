import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const patchSchema = z.object({
  plannedAmount: z.coerce.number().positive().optional(),
  actualAmount: z.coerce.number().nonnegative().nullable().optional(),
  isSkipped: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const entry = await prisma.monthlyEntry.findFirst({
    where: { id, householdId: session.householdId },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Some details are missing or invalid." }, { status: 400 });
  }

  // plannedAmount is this month's own editable plan and is fair game on any
  // entry, recurring-linked or one-off — it defaults from the line item's
  // baseAmount at generation but diverges freely from there. baseAmount
  // itself is a snapshot and is never accepted by this route.
  const updated = await prisma.monthlyEntry.update({
    where: { id: entry.id },
    data: parsed.data,
  });

  return NextResponse.json({ entry: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const entry = await prisma.monthlyEntry.findFirst({
    where: { id, householdId: session.householdId },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  if (entry.lineItemId) {
    return NextResponse.json(
      { error: "This is a recurring line — skip this occurrence instead of deleting it." },
      { status: 400 }
    );
  }

  await prisma.monthlyEntry.delete({ where: { id: entry.id } });
  return NextResponse.json({ ok: true });
}
