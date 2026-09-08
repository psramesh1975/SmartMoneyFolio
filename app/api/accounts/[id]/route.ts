import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.householdId) return NextResponse.json({ error: "No household." }, { status: 403 });
  if (session.role === "VIEWER") {
    return NextResponse.json({ error: "Viewers can't delete accounts." }, { status: 403 });
  }

  const account = await prisma.account.findFirst({
    where: { id, householdId: session.householdId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  await prisma.account.delete({ where: { id: account.id } });
  return NextResponse.json({ ok: true });
}
