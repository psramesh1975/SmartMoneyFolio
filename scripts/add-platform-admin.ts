/**
 * Provisions an ADDITIONAL platform Super Admin login, without touching the
 * existing bootstrap admin created by prisma/seed.ts (ADMIN_EMAIL /
 * ADMIN_INITIAL_PASSWORD). Reusable — run it again with different env vars
 * any time another Super Admin login needs to be added.
 *
 * NOT wired into package.json's build/seed scripts and NOT re-run on every
 * deploy — run explicitly, once per new admin:
 *   npx tsx --env-file=.env.local scripts/add-platform-admin.ts
 * or, against production, from a machine with network access to Neon:
 *   DATABASE_URL=<neon prod url> NEW_ADMIN_EMAIL=... NEW_ADMIN_PASSWORD=... \
 *     npx tsx scripts/add-platform-admin.ts
 *
 * Requires in the environment:
 *   DATABASE_URL        (already required by the app)
 *   NEW_ADMIN_EMAIL      e.g. smartmoneyfolio@gmail.com
 *   NEW_ADMIN_PASSWORD   a strong, unique password — set it directly in the
 *                        shell/env, never hardcode it in this file or commit
 *                        it anywhere.
 *
 * Safe to re-run: if the email already exists, it exits without changes
 * rather than overwriting an existing account's password or role.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.NEW_ADMIN_EMAIL;
  const password = process.env.NEW_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set NEW_ADMIN_EMAIL and NEW_ADMIN_PASSWORD in your environment before running this script."
    );
  }
  if (password.length < 12) {
    throw new Error("NEW_ADMIN_PASSWORD should be at least 12 characters.");
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    console.log(
      `A user with email ${normalizedEmail} already exists (isPlatformOwner=${existing.isPlatformOwner}) — no changes made.`
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      isPlatformOwner: true,
      // Same convention as the bootstrap admin: purely administrative,
      // no household attached.
    },
  });

  console.log(`Created additional platform Super Admin: ${normalizedEmail}`);
  console.log("Existing Super Admin logins are unaffected. Log in and change the password on first use.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
