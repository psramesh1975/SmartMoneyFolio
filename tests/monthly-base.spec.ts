import { test, expect, type Page } from "@playwright/test";

/**
 * Route is /monthly/base (app/(app)/monthly/base/page.tsx).
 *
 * formatCurrency() (lib/format-currency.ts) renders "<CODE> <n,nnn.nn>"
 * (negative amounts as "<CODE> -n,nnn.nn", e.g. the Net Monthly Buffer when
 * a household spends more than it earns), and renders a zero amount as the
 * literal string "-". Assertions below match that, not a ₹ symbol.
 *
 * As of the Income/Expense revamp, the page is four always-visible bordered
 * card-tables (no more collapsible section-divider rows) in this order:
 * Recurring Income & Inflows, Liabilities & Debt Servicing (EMIs),
 * Investments & SIPs, Monthly Base Expenses & Overhead. Debt/SIP rows keep
 * their pre-revamp data-testid contract:
 *   sip-section-row-<rowId> / debt-section-row-<rowId>
 *   sip-section-row-badge-<rowId> / debt-section-row-badge-<rowId>
 */

const CURRENCY_TOKEN = /[A-Z]{3}\s-?[\d,]+\.\d{2}/; // e.g. "INR 5,000.00" or "INR -5,000.00"

function parseCurrency(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "-") return 0;
  const match = trimmed.match(/(-)?([\d,]+\.\d{2})/);
  if (!match) throw new Error(`Could not parse currency amount from "${text}"`);
  const value = Number(match[2].replace(/,/g, ""));
  return match[1] ? -value : value;
}

// Each card-table's footer amount carries the font-mono class used nowhere
// else in that row, so this resolves to exactly one cell regardless of
// whether the subtotal happens to be zero (rendered as the literal "-").
async function cardSubtotal(page: Page, cardTitleSubstring: string): Promise<number> {
  const card = page.locator("table").filter({ hasText: cardTitleSubstring });
  const footerAmount = card.locator("tfoot td.font-mono").first();
  return parseCurrency(await footerAmount.innerText());
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

  test("four card-tables render, in mockup order: Income, Debt, SIPs, Expenses", async ({ page }) => {
    const cardTitles = ["Recurring Income & Inflows", "Liabilities & Debt Servicing", "Investments & SIPs", "Monthly Base Expenses & Overhead"];
    const tables = page.locator("table");
    await expect(tables).toHaveCount(4);
    for (let i = 0; i < cardTitles.length; i++) {
      await expect(tables.nth(i)).toContainText(cardTitles[i]);
    }
  });

  test("auto-synced SIP and EMI rows render read-only with the right badges, always visible", async ({ page }) => {
    const sipRows = page.locator('[data-testid^="sip-section-row-"]:not([data-testid*="badge"])');
    const sipCount = await sipRows.count();
    for (let i = 0; i < sipCount; i++) {
      const row = sipRows.nth(i);
      await expect(row).toBeVisible();
      const badge = row.locator('[data-testid^="sip-section-row-badge-"]');
      await expect(badge).toHaveText("Active SIP");
      await expect(row.getByRole("button")).toHaveCount(0);
    }

    const debtRows = page.locator('[data-testid^="debt-section-row-"]:not([data-testid*="badge"])');
    const debtCount = await debtRows.count();
    for (let i = 0; i < debtCount; i++) {
      const row = debtRows.nth(i);
      await expect(row).toBeVisible();
      const badge = row.locator('[data-testid^="debt-section-row-badge-"]');
      await expect(badge).toHaveText("EMI");
      await expect(row.getByRole("button")).toHaveCount(0);
    }
  });

  test("no raw unformatted numbers render — every amount matches the currency formatter", async ({ page }) => {
    // Excludes <input> — the editable baseAmount fields carry this same
    // class for alignment, but innerText() on an <input> is always "" (its
    // value lives in the value attribute, not as text content), which
    // isn't a formatting bug to catch here.
    const amountNodes = page.locator("[class*='tabular-nums']:not(input)");
    const count = await amountNodes.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = (await amountNodes.nth(i).innerText()).trim();
      expect(text === "-" || CURRENCY_TOKEN.test(text)).toBeTruthy();
    }
  });

  test("Total Base Outflow reconciles to Debt + SIP + Expense card subtotals", async ({ page }) => {
    // page.locator("div", { hasText }).first() matches in DOM order, which
    // is outermost-ancestor-first — on this page that's a huge wrapper div
    // containing the whole sidebar/topbar, not the KPI card, so .first()
    // grabs an unrelated ancestor. :has(> span:text-is()) scopes to the one
    // div whose *direct* child span carries this exact label, i.e. the
    // actual card.
    const kpiCard = page.locator("div:has(> span:text-is('Total Base Outflow'))");
    const total = parseCurrency(await kpiCard.locator("p").first().innerText());

    const debtSubtotal = await cardSubtotal(page, "Liabilities & Debt Servicing");
    const sipSubtotal = await cardSubtotal(page, "Investments & SIPs");
    const expenseSubtotal = await cardSubtotal(page, "Monthly Base Expenses & Overhead");

    expect(total).toBeCloseTo(debtSubtotal + sipSubtotal + expenseSubtotal, 2);
  });

  test("Expected Monthly Income reconciles to the Income card subtotal", async ({ page }) => {
    const kpiCard = page.locator("div:has(> span:text-is('Expected Monthly Income'))");
    const total = parseCurrency(await kpiCard.locator("p").first().innerText());
    const incomeSubtotal = await cardSubtotal(page, "Recurring Income & Inflows");
    expect(total).toBeCloseTo(incomeSubtotal, 2);
  });

  test("Net Monthly Buffer equals Expected Monthly Income minus Total Base Outflow", async ({ page }) => {
    const income = parseCurrency(
      await page.locator("div:has(> span:text-is('Expected Monthly Income'))").locator("p").first().innerText()
    );
    const outflow = parseCurrency(
      await page.locator("div:has(> span:text-is('Total Base Outflow'))").locator("p").first().innerText()
    );
    const buffer = parseCurrency(
      await page.locator("div:has(> span:text-is('Net Monthly Buffer'))").locator("p").first().innerText()
    );
    expect(buffer).toBeCloseTo(income - outflow, 2);
  });

  test("Wealth Building KPI subtitle explicitly references Debt Servicing", async ({ page }) => {
    // Same fix as the KPI-card locator above: scope to the div whose direct
    // child span is the "Wealth Building" label, not an outer wrapper that
    // happens to also contain this text somewhere in its subtree.
    const wealthCard = page.locator("div:has(> span:text-is('Wealth Building'))");
    await expect(wealthCard.getByText(/Debt Servicing \+ SIPs/)).toBeVisible();
  });
});
