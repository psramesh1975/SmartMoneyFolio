import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INCOME", "OUTFLOW"]),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });

  const categories = await prisma.monthlyCategory.findMany({
    where: { householdId: session.householdId },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ categories });
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

  // Case-insensitive duplicate guard — lets the Monthly Base combobox recover
  // cleanly from a race (two rows creating the same new category at once)
  // by just re-fetching and selecting the one that won, instead of erroring.
  const existing = await prisma.monthlyCategory.findFirst({
    where: {
      householdId: session.householdId,
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A category with that name already exists." },
      { status: 409 }
    );
  }

  const last = await prisma.monthlyCategory.findFirst({
    where: { householdId: session.householdId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const category = await prisma.monthlyCategory.create({
    data: {
      householdId: session.householdId,
      name: parsed.data.name,
      type: parsed.data.type,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json({ category });
}
