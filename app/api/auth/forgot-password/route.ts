import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always return the same generic response whether or not the account
  // exists — this prevents the endpoint from being used to enumerate
  // registered emails.
  if (user) {
    const { token, tokenHash } = generateResetToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://smartmoneyfolio.com"}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
      console.error("Failed to send reset email:", err); // don't leak this to the response
    });
  }

  return NextResponse.json({
    message: "If an account exists with that email, a reset link has been sent.",
  });
}
