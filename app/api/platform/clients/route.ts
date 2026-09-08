import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.isPlatformOwner) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const households = await prisma.household.findMany({
    include: {
      users: { select: { id: true, email: true, role: true, status: true } },
      _count: { select: { familyMembers: true, accounts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ households });
}
