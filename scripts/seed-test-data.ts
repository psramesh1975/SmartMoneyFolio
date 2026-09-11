/**
 * Seeds a clean E2E test tenant for Playwright runs.
 *
 * NOT wired into package.json's build/seed scripts — run explicitly:
 *   npx tsx scripts/seed-test-data.ts
 * (mirrors the existing "never wire seed scripts into the deploy pipeline"
 * convention already followed by scripts/seed-securities.ts.)
 *
 * Requires in .env / .env.local:
 *   DATABASE_URL              (already required by the app)
 *   TEST_CLIENT_EMAIL         e.g. e2e-client@smartmoneyfolio.test
 *   TEST_CLIENT_PASSWORD      e.g. a long random string, test-only
 *
 * Does NOT create the platform Super Admin — that's already handled by the
 * app's own prisma/seed.ts (ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD). Mixing
 * the two into one script would blur which one owns which account.
 *
 * Idempotent: reruns against an existing tenant update the same rows
 * in place (matched by householdId + fixed slugs below) instead of
 * duplicating them, so repeated CI runs stay predictable.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_HOUSEHOLD_NAME = "Playwright E2E Household";
const SIP_HOLDING_NAME = "Quant Small Cap Fund";
const LOAN_NAME = "ICICI Home Loan";
const SUBSCRIPTIONS_CATEGORY_NAME = "Subscriptions";

async function main() {
  const email = process.env.TEST_CLIENT_EMAIL;
  const password = process.env.TEST_CLIENT_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set TEST_CLIENT_EMAIL and TEST_CLIENT_PASSWORD in your environment before seeding test data."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  // --- Household + login -------------------------------------------------
  let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { household: true } });

  const household = user?.household
    ? await prisma.household.update({
        where: { id: user.household.id },
        data: { name: TEST_HOUSEHOLD_NAME, baseCurrency: "INR", operationalCurrency: "INR", country: "IN", timeZone: "Asia/Kolkata" },
      })
    : await prisma.household.create({
        data: {
          name: TEST_HOUSEHOLD_NAME,
          country: "IN",
          timeZone: "Asia/Kolkata",
          baseCurrency: "INR",
          operationalCurrency: "INR",
        },
      });

  user = user
    ? await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, householdId: household.id, isPlatformOwner: false, status: "active" },
        include: { household: true },
      })
    : await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          householdId: household.id,
          isPlatformOwner: false,
        },
        include: { household: true },
      });

  // --- Family members ------------------------------------------------------
  const self = await upsertFamilyMember(household.id, "Self", "Self", user.id);
  await upsertFamilyMember(household.id, "Spouse", "Spouse");

  // --- 1 Active SIP: Quant Small Cap Fund @ ₹5,000/month --------------------
  const existingSip = await prisma.account.findFirst({
    where: { householdId: household.id, holdingName: SIP_HOLDING_NAME },
  });
  if (existingSip) {
    await prisma.account.update({
      where: { id: existingSip.id },
      data: { sipMonthlyAmount: 5000, currency: "INR" },
    });
  } else {
    await prisma.account.create({
      data: {
        householdId: household.id,
        familyMemberId: self.id,
        assetClass: "MUTUAL_FUNDS",
        holdingName: SIP_HOLDING_NAME,
        currency: "INR",
        currentValue: 150000,
        sipMonthlyAmount: 5000,
      },
    });
  }

  // --- 1 Active Loan: ICICI Home Loan, ₹10,000 EMI ---------------------------
  const existingLoan = await prisma.liability.findFirst({
    where: { householdId: household.id, name: LOAN_NAME },
  });
  if (existingLoan) {
    await prisma.liability.update({
      where: { id: existingLoan.id },
      data: { emiAmount: 10000, currency: "INR" },
    });
  } else {
    await prisma.liability.create({
      data: {
        householdId: household.id,
        familyMemberId: self.id,
        liabilityType: "HOME_LOAN",
        name: LOAN_NAME,
        currency: "INR",
        outstandingBalance: 3500000,
        interestRate: 8.65,
        emiAmount: 10000,
      },
    });
  }

  // --- 1 Fixed living expense: Subscriptions @ ₹1,00,000 ---------------------
  // Manual (non-auto-linked) category + line item — this is what powers the
  // "Living Expenses & Subscriptions" side of the Monthly Base reconciliation.
  let subsCategory = await prisma.monthlyCategory.findFirst({
    where: { householdId: household.id, name: SUBSCRIPTIONS_CATEGORY_NAME },
  });
  if (!subsCategory) {
    subsCategory = await prisma.monthlyCategory.create({
      data: {
        householdId: household.id,
        name: SUBSCRIPTIONS_CATEGORY_NAME,
        type: "OUTFLOW",
        spendKind: "FIXED",
        isSubscription: true,
      },
    });
  }

  const existingLine = await prisma.monthlyLineItem.findFirst({
    where: { householdId: household.id, categoryId: subsCategory.id, name: SUBSCRIPTIONS_CATEGORY_NAME },
  });
  if (existingLine) {
    await prisma.monthlyLineItem.update({ where: { id: existingLine.id }, data: { baseAmount: 100000, isActive: true } });
  } else {
    await prisma.monthlyLineItem.create({
      data: {
        householdId: household.id,
        categoryId: subsCategory.id,
        name: SUBSCRIPTIONS_CATEGORY_NAME,
        baseAmount: 100000,
        repeatMonths: [],
        startYear: now.getFullYear(),
        startMonth: now.getMonth() + 1,
        isActive: true,
      },
    });
  }

  console.log(`Seeded test tenant "${household.name}" (${household.id}) for ${email}.`);
}

async function upsertFamilyMember(householdId: string, name: string, relationship: string, linkedUserId?: string) {
  const existing = await prisma.familyMember.findFirst({ where: { householdId, name } });
  if (existing) {
    return prisma.familyMember.update({
      where: { id: existing.id },
      data: { relationship, linkedUserId: linkedUserId ?? existing.linkedUserId },
    });
  }
  return prisma.familyMember.create({
    data: {
      householdId,
      name,
      relationship,
      operationalCurrency: "INR",
      residencyStatus: "RESIDENT_INDIAN",
      linkedUserId,
      city: name === "Self" ? "Mumbai" : undefined,
      address: name === "Self" ? "Test address, Mumbai" : undefined,
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
