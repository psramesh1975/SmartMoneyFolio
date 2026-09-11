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
    // Excludes <input> — the editable baseAmount fields in General Recurring
    // Expenses carry this same class for alignment, but innerText() on an
    // <input> is always "" (its value lives in the value attribute, not as
    // text content), which isn't a formatting bug to catch here.
    const amountNodes = page.locator("[class*='tabular-nums']:not(input)");
    const count = await amountNodes.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await amountNodes.nth(i).innerText()).trim();
      expect(text === "-" || CURRENCY_TOKEN.test(text)).toBeTruthy();
    }
  });

  test("Total Monthly Base Outflow reconciles to auto-linked + manual category subtotals", async ({ page }) => {
    // page.locator("div", { hasText }).first() matches in DOM order, which
    // is outermost-ancestor-first — on this page that's a huge wrapper div
    // containing the whole sidebar/topbar, not the KPI card, so .first()
    // grabbed an unrelated <p> (the household name). :has(> span:text-is())
    // scopes to the one div whose *direct* child span carries this exact
    // label, i.e. the actual card.
    const kpiCard = page.locator("div:has(> span:text-is('Total Monthly Base Outflow'))");
    const totalText = await kpiCard.locator("p").first().innerText();
    const total = parseCurrency(totalText);

    // The toggle's second top-level <span> wraps [amount-span, chevron]; that
    // wrapper's own text also contains the currency token (chevron is an SVG,
    // no text), so the plain filter matches it AND the inner amount span —
    // two elements, which .innerText() rejects under Playwright's strict
    // mode. .last() resolves to the innermost (actual) amount span.
    const sipToggle = await openAutoSection(page, "sip-section");
    const sipSubtotal = parseCurrency(await sipToggle.locator("span").filter({ hasText: CURRENCY_TOKEN }).last().innerText());

    const debtToggle = await openAutoSection(page, "debt-section");
    const debtSubtotal = parseCurrency(await debtToggle.locator("span").filter({ hasText: CURRENCY_TOKEN }).last().innerText());

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
    // Same fix as the KPI-card locator above: scope to the div whose direct
    // child span is the "Wealth Building" label, not an outer wrapper that
    // happens to also contain this text somewhere in its subtree — the
    // .first() version passed today, but only because its overly broad
    // match still happened to contain the right text further down.
    const wealthCard = page.locator("div:has(> span:text-is('Wealth Building'))");
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
