import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCurrentPeriod } from "@/lib/monthly-periods";
import { getHouseholdTimeZone } from "@/lib/monthly-data";

const repeatMonthSchema = z.number().int().min(1).max(12);

const createSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  // nonnegative, not positive — Monthly Base rows start at 0.00 (the amount
  // may genuinely be unknown yet), same as a freshly added spreadsheet row.
  baseAmount: z.coerce.number().nonnegative(),
  repeatMonths: z.array(repeatMonthSchema).default([]),
  liabilityId: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;

  const lineItems = await prisma.monthlyLineItem.findMany({
    where: {
      householdId: session.householdId,
      isActive: true,
      ...(categoryId ? { categoryId } : {}),
    },
    include: { category: { select: { name: true, type: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ lineItems });
}

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

  if (parsed.data.liabilityId) {
    const liability = await prisma.liability.findFirst({
      where: { id: parsed.data.liabilityId, householdId: session.householdId },
    });
    if (!liability) return NextResponse.json({ error: "That liability wasn't found." }, { status: 400 });
  }

  const timeZone = await getHouseholdTimeZone(session.householdId);
  const { year, month } = getCurrentPeriod(timeZone);

  const lineItem = await prisma.monthlyLineItem.create({
    data: {
      householdId: session.householdId,
      categoryId: category.id,
      name: parsed.data.name,
      baseAmount: parsed.data.baseAmount,
      repeatMonths: parsed.data.repeatMonths,
      liabilityId: parsed.data.liabilityId,
      startYear: year,
      startMonth: month,
    },
  });

  return NextResponse.json({ lineItem });
}
