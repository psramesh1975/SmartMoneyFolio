import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD in your environment (.env.local) before seeding."
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (existing) {
    // One-time cleanup: earlier versions of this app attached a private
    // household (with family data) to the platform admin account. The
    // admin is now purely administrative, so detach and remove that
    // household if it's still hanging around.
    if (existing.isPlatformOwner && existing.householdId) {
      const oldHouseholdId = existing.householdId;
      await prisma.user.update({
        where: { id: existing.id },
        data: { householdId: null },
      });
      await prisma.household.delete({ where: { id: oldHouseholdId } });
      console.log(`Detached and removed the old private household from ${email}.`);
    } else {
      console.log(`A user with email ${email} already exists — skipping seed.`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // The platform Super Admin: an administrative-only login with no
  // household and no financial data attached. It exists purely to manage
  // clients on the /platform screen.
  await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      isPlatformOwner: true,
    },
  });

  console.log(`Seeded platform Super Admin account for ${email}.`);
  console.log("Log in with this email and the ADMIN_INITIAL_PASSWORD you set, then change your password.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
