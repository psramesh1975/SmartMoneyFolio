import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { household: { select: { isSuspended: true } } },
  });

  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "No account matches that email and password." }, { status: 401 });
  }

  if (user.household?.isSuspended) {
    return NextResponse.json(
      { error: "This account has been suspended. Contact support for help." },
      { status: 403 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "No account matches that email and password." }, { status: 401 });
  }

  await createSession({
    userId: user.id,
    householdId: user.householdId,
    role: user.role,
    email: user.email,
    isPlatformOwner: user.isPlatformOwner,
  });

  return NextResponse.json({ ok: true });
}
