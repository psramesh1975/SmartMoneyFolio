import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Hard delete: permanently removes the household and everything scoped to
// it (users, family members, accounts, liabilities, goals, monthly
// categories/line items/entries). Every one of those relations already
// carries onDelete: Cascade back to Household in prisma/schema.prisma, so a
// single delete on Household is sufficient — verified against the live
// schema before writing this route. There is no soft-delete/undo; the
// client confirms by typing the household's name before this is called.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.isPlatformOwner) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const household = await prisma.household.findFirst({ where: { id: householdId } });
  if (!household) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  await prisma.household.delete({ where: { id: household.id } });

  return NextResponse.json({ deleted: true });
}
