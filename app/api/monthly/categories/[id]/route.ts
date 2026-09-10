import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["INCOME", "OUTFLOW"]).optional(),
  sortOrder: z.coerce.number().int().optional(),
  spendKind: z.enum(["FIXED", "VARIABLE"]).nullable().optional(),
  isSubscription: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const category = await prisma.monthlyCategory.findFirst({
    where: { id, householdId: session.householdId },
  });
  if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Some details are missing or invalid." }, { status: 400 });
  }

  const updated = await prisma.monthlyCategory.update({
    where: { id: category.id },
    data: parsed.data,
  });

  return NextResponse.json({ category: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const category = await prisma.monthlyCategory.findFirst({
    where: { id, householdId: session.householdId },
    include: { _count: { select: { lineItems: true, entries: true } } },
  });
  if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  if (category._count.lineItems > 0 || category._count.entries > 0) {
    return NextResponse.json(
      { error: "Remove its line items first." },
      { status: 400 }
    );
  }

  await prisma.monthlyCategory.delete({ where: { id: category.id } });
  return NextResponse.json({ ok: true });
}
