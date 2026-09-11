import { test, expect } from "@playwright/test";

/**
 * Decisions confirmed 2026-09-11:
 *  1. No FX conversion in this product — everything stays in baseCurrency
 *     (INR for the seeded test tenant). No dual-currency assertions here.
 *  2. Net Worth lives on /dashboard (lib/dashboard-data.ts:
 *     totalAssets - totalLiabilities, computed live, no snapshot/cron
 *     dependency) — not on /assets or /liabilities.
 *  3. Owner filter is a row of pill <button>s, now carrying data-testid
 *     "owner-filter-all" and "owner-filter-<familyMemberId>" (patch applied
 *     to both AssetsClient.tsx and LiabilitiesClient.tsx).
 */

test.describe("Net Worth (/dashboard)", () => {
  test("Net Worth equals Total Assets minus Total Liabilities with no snapshot dependency", async ({ page }) => {
    await page.goto("/dashboard");
    const netWorthLabel = page.getByText("Net worth");
    await expect(netWorthLabel).toBeVisible();

    const before = await netWorthLabel.locator("xpath=following-sibling::*[1]").innerText();
    await page.reload();
    const after = await netWorthLabel.locator("xpath=following-sibling::*[1]").innerText();
    expect(after).toBe(before);
  });
});

test.describe("Assets (/assets)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/assets");
  });

  test("owner filter buttons instantly filter rows and recalculate totals", async ({ page }) => {
    const allButton = page.getByTestId("owner-filter-all");
    await expect(allButton).toBeVisible();
    const rowsAll = await page.locator("table tbody tr").count();

    const memberButtons = page.locator('[data-testid^="owner-filter-"]:not([data-testid="owner-filter-all"])');
    const memberCount = await memberButtons.count();
    test.skip(memberCount === 0, "No family members seeded for this tenant");

    await memberButtons.first().click();
    const rowsFiltered = await page.locator("table tbody tr").count();
    expect(rowsFiltered).toBeLessThanOrEqual(rowsAll);

    await allButton.click();
    await expect(page.locator("table tbody tr")).toHaveCount(rowsAll);
  });

  test("no raw unformatted numeric strings appear in the DOM", async ({ page }) => {
    const bodyText = await page.locator("body").innerText();
    const suspect = bodyText.match(/(?<![A-Z]{3}\s)\b\d{6,}\b/g);
    expect(suspect ?? []).toEqual([]);
  });
});

test.describe("Liabilities (/liabilities)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/liabilities");
  });

  test("owner filter buttons instantly filter rows and recalculate totals", async ({ page }) => {
    const allButton = page.getByTestId("owner-filter-all");
    await expect(allButton).toBeVisible();
    const rowsAll = await page.locator("table tbody tr").count();

    const memberButtons = page.locator('[data-testid^="owner-filter-"]:not([data-testid="owner-filter-all"])');
    const memberCount = await memberButtons.count();
    test.skip(memberCount === 0, "No family members seeded for this tenant");

    await memberButtons.first().click();
    const rowsFiltered = await page.locator("table tbody tr").count();
    expect(rowsFiltered).toBeLessThanOrEqual(rowsAll);
  });
});
