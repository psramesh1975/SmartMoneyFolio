import bcrypt from "bcryptjs";
import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "wb_session";
const SESSION_MAX_SECONDS = 60 * 60 * 12; // 12h hard cap — safety net only, cookie itself is session-scoped

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set a random string of 32+ characters in your environment variables."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Password reset tokens. Plaintext token goes in the emailed link; only its
// hash is ever stored (User.resetTokenHash), mirroring how passwords are
// handled (bcrypt hash stored, plaintext never persisted). A plain SHA-256
// hash (not bcrypt) is fine here — unlike a password, this token is 32
// random bytes with no guessable structure to brute-force, and the lookup
// needs a fast, direct hash match rather than bcrypt's deliberately slow
// per-guess comparison.
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type SessionPayload = {
  userId: string;
  householdId: string | null;
  email: string;
  isPlatformOwner: boolean;
};

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Deliberately no maxAge / no expires: this makes it a session cookie,
    // cleared by the browser when fully closed. Do not add maxAge back.
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
