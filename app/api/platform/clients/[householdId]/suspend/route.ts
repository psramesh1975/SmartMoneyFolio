import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.isPlatformOwner) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const household = await prisma.household.findFirst({
    where: { id: householdId },
  });
  if (!household) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const updated = await prisma.household.update({
    where: { id: household.id },
    data: { isSuspended: !household.isSuspended },
  });

  return NextResponse.json({ isSuspended: updated.isSuspended });
}
