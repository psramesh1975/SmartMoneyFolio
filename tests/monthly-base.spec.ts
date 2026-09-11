import { test, expect, type Page } from "@playwright/test";

/**
 * Route is /monthly/base (app/(app)/monthly/base/page.tsx).
 *
 * formatCurrency() (lib/format-currency.ts) renders "<CODE> <n,nnn.nn>",
 * e.g. "INR 1,00,000.00", and renders a zero amount as the literal string
 * "-". Assertions below match that, not a ₹ symbol.
 *
 * Selectors now use the data-testid attributes added to
 * components/MonthlyBaseClient.tsx's AutoSection:
 *   sip-section-toggle / debt-section-toggle
 *   sip-section-row-<rowId> / debt-section-row-<rowId>
 *   sip-section-row-badge-<rowId> / debt-section-row-badge-<rowId>
 */

const CURRENCY_TOKEN = /[A-Z]{3}\s[\d,]+\.\d{2}/; // e.g. "INR 5,000.00"

async function openAutoSection(page: Page, testId: string) {
  const toggle = page.getByTestId(`${testId}-toggle`);
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
  return toggle;
}

test.describe("Monthly Base blueprint (/monthly/base)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/monthly/base");
    await expect(page.getByRole("heading", { name: "Monthly Base" })).toBeVisible();
  });

  test("no dead placeholder selectors remain on the page", async ({ page }) => {
    await expect(page.getByText("— None —")).toHaveCount(0);
    await expect(page.locator("select option", { hasText: "None" })).toHaveCount(0);
  });

  test("auto-synced SIP and EMI rows render read-only with the right badges", async ({ page }) => {
    const sipToggle = await openAutoSection(page, "sip-section");
    await expect(sipToggle).toBeVisible();
    const sipRows = page.locator('[data-testid^="sip-section-row-"]:not([data-testid*="badge"])');
    const sipCount = await sipRows.count();
    for (let i = 0; i < sipCount; i++) {
      const row = sipRows.nth(i);
      const badge = row.locator('[data-testid^="sip-section-row-badge-"]');
      await expect(badge).toHaveText("Active SIP");
      await expect(row.getByRole("button")).toHaveCount(0);
    }

    const debtToggle = await openAutoSection(page, "debt-section");
    await expect(debtToggle).toBeVisible();
    const debtRows = page.locator('[data-testid^="debt-section-row-"]:not([data-testid*="badge"])');
    const debtCount = await debtRows.count();
    for (let i = 0; i < debtCount; i++) {
      const row = debtRows.nth(i);
      const badge = row.locator('[data-testid^="debt-section-row-badge-"]');
      await expect(badge).toHaveText("EMI");
      await expect(row.getByRole("button")).toHaveCount(0);
    }
  });

  test("no raw unformatted numbers render — every amount matches the currency formatter", async ({ page }) => {
    const amountNodes = page.locator("[class*='tabular-nums']");
    const count = await amountNodes.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await amountNodes.nth(i).innerText()).trim();
      expect(text === "-" || CURRENCY_TOKEN.test(text)).toBeTruthy();
    }
  });

  test("Total Monthly Base Outflow reconciles to auto-linked + manual category subtotals", async ({ page }) => {
    const kpiCard = page.locator("div", { hasText: "Total Monthly Base Outflow" }).first();
    const totalText = await kpiCard.locator("p").first().innerText();
    const total = parseCurrency(totalText);

    const sipToggle = await openAutoSection(page, "sip-section");
    const sipSubtotal = parseCurrency(await sipToggle.locator("span").filter({ hasText: CURRENCY_TOKEN }).innerText());

    const debtToggle = await openAutoSection(page, "debt-section");
    const debtSubtotal = parseCurrency(await debtToggle.locator("span").filter({ hasText: CURRENCY_TOKEN }).innerText());

    const allToggles = page.locator("button[aria-expanded]");
    const toggleCount = await allToggles.count();
    let manualSubtotal = 0;
    for (let i = 0; i < toggleCount; i++) {
      const el = allToggles.nth(i);
      const testId = await el.getAttribute("data-testid");
      if (testId === "sip-section-toggle" || testId === "debt-section-toggle") continue;
      const label = el.locator("span").filter({ hasText: CURRENCY_TOKEN });
      if (await label.count()) {
        manualSubtotal += parseCurrency(await label.first().innerText());
      }
    }

    expect(total).toBeCloseTo(sipSubtotal + debtSubtotal + manualSubtotal, 2);
  });

  test("Wealth Building KPI subtitle explicitly references Debt Servicing", async ({ page }) => {
    const wealthCard = page.locator("div", { hasText: "Wealth Building" }).first();
    await expect(wealthCard.getByText(/Debt Servicing \+ SIPs/)).toBeVisible();
  });
});

function parseCurrency(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "-") return 0;
  const match = trimmed.match(/([\d,]+\.\d{2})/);
  if (!match) throw new Error(`Could not parse currency amount from "${text}"`);
  return Number(match[1].replace(/,/g, ""));
}
