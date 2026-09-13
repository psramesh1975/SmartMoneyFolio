import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashResetToken, hashPassword } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const user = await prisma.user.findFirst({
    where: {
      resetTokenHash: tokenHash,
      resetTokenExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      resetTokenHash: null,
      resetTokenExpires: null,
    },
  });

  return NextResponse.json({ ok: true });
}
