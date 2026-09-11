import { defineConfig, devices } from "@playwright/test";

/**
 * Two auth states are produced by tests/auth.setup.ts:
 *  - playwright/.auth/client.json   → seeded HOUSEHOLD user (TEST_CLIENT_EMAIL)
 *  - playwright/.auth/platform.json → seeded Platform Super Admin (ADMIN_EMAIL)
 *
 * ADMIN_EMAIL seeds a Platform Super Admin with householdId = null (see
 * prisma/seed.ts). That account is redirected to /platform and can never
 * reach /monthly/base, /assets, or /liabilities — those all
 * `redirect(session.isPlatformOwner ? "/platform" : "/login")` when
 * householdId is missing. All functional suites below use the "client"
 * storage state, not "admin".
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Runs first, has no dependency, produces both storage-state files.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/client.json",
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 7"],
        storageState: "playwright/.auth/client.json",
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
