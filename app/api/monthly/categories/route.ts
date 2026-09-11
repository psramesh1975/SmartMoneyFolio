import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INCOME", "OUTFLOW"]),
  spendKind: z.enum(["FIXED", "VARIABLE"]).nullable().optional(),
  isSubscription: z.boolean().optional().default(false),
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

  // The findFirst check above is a best-effort, case-insensitive guard for
  // a friendly error on the common path — it has the same race window any
  // check-then-create does. The DB's @@unique([householdId, name, type])
  // constraint is the real backstop for two concurrent creates of the same
  // exact name; P2002 here means that constraint caught a race the
  // pre-check missed.
  let category;
  try {
    category = await prisma.monthlyCategory.create({
      data: {
        householdId: session.householdId,
        name: parsed.data.name,
        type: parsed.data.type,
        spendKind: parsed.data.spendKind ?? null,
        isSubscription: parsed.data.isSubscription,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A category with that name already exists." },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ category });
}
