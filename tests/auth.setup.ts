import { test as setup, expect } from "@playwright/test";

/**
 * Targets the login form via the data-testid attributes added by the
 * data-testid patch (app/login/page.tsx): login-email, login-password,
 * login-submit. No longer relying on #id or accessible-name text matching.
 *
 * Two accounts, two purposes:
 *  - TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD: a regular household user
 *    (seeded by scripts/seed-test-data.ts) — used by every functional spec.
 *  - ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD: the platform Super Admin (seeded
 *    by the app's own prisma/seed.ts). Saved for completeness / future
 *    /platform suites, but NOT used by monthly-base or balance-sheet specs,
 *    since that account has no household.
 */

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  // Successful login redirects away from /login (to /dashboard for a
  // household user, or /platform for the platform admin). Back to the
  // original 10s (PERF-01): /dashboard's headline row no longer calls
  // getMonthPayload()'s write/reconcile path on every load (see
  // computeDashboardCashFlow() in lib/dashboard-data.ts) — the 20s bump from
  // Phase 8 was a bandage for that ~8s render cost, not a real requirement.
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 10_000 });
}

setup("authenticate as household client", async ({ page }) => {
  const email = process.env.TEST_CLIENT_EMAIL;
  const password = process.env.TEST_CLIENT_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set TEST_CLIENT_EMAIL and TEST_CLIENT_PASSWORD (the household user created by " +
        "scripts/seed-test-data.ts) before running the suite."
    );
  }

  await login(page, email, password);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: "playwright/.auth/client.json" });
});

setup("authenticate as platform admin", async ({ page }) => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD (seeded via `npm run seed`).");
  }

  await login(page, email, password);
  await expect(page).toHaveURL(/\/platform/);
  await page.context().storageState({ path: "playwright/.auth/platform.json" });
});
