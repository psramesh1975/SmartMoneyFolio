import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const createSchema = z.object({
  categoryId: z.string().min(1),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
  name: z.string().min(1),
  plannedAmount: z.coerce.number().positive(),
  actualAmount: z.coerce.number().nonnegative().optional(),
});

// Adds a one-off entry directly into a specific month — lineItemId stays
// null, so it never becomes recurring.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Some details are missing or invalid." }, { status: 400 });
  }

  const category = await prisma.monthlyCategory.findFirst({
    where: { id: parsed.data.categoryId, householdId: session.householdId },
  });
  if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  const entry = await prisma.monthlyEntry.create({
    data: {
      householdId: session.householdId,
      categoryId: category.id,
      lineItemId: null,
      year: parsed.data.year,
      month: parsed.data.month,
      name: parsed.data.name,
      // No separate "base" for a one-time entry — base and planned start equal,
      // though planned can still be edited independently afterward.
      baseAmount: parsed.data.plannedAmount,
      plannedAmount: parsed.data.plannedAmount,
      actualAmount: parsed.data.actualAmount ?? null,
    },
  });

  return NextResponse.json({ entry });
}
