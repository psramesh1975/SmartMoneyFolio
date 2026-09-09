# Phase 5 — Monthly Planned-vs-Actual Tracker

Repo: `psramesh1975/SmartMoneyFolio`

## 0. What this phase is

A recurring, planned-vs-actual monthly tracker (income, EMIs/debt, expenses, subscriptions, savings/investments — whatever categories the household defines), replacing the household's manual monthly spreadsheet. Household-level only (no per-family-member split), single currency (the household's `baseCurrency`, same field already on `Household`).

Core idea: you set up categories (e.g. Income, EMI/Debt, Expenses, Subscriptions, Savings) and recurring line items inside them once. Every month, those line items automatically populate that month's sheet with a snapshot of the planned amount at that moment — so editing a line item's planned amount later only affects months that haven't been generated yet. Past and already-open months keep what they had. You can also add one-off entries into a single month without creating a recurring line, and you can skip a single occurrence of a recurring line without cancelling it.

There is no migration/cron job for year-end rollover. "Previous / Current / Next / Earlier Months / Earlier Years" are all computed live from today's date each time a page loads — nothing physically moves at year-end.

## 1. Prisma schema additions

Add to `prisma/schema.prisma` (don't touch existing models):

```prisma
enum MonthlyCategoryType {
  INCOME
  OUTFLOW
}

// A household-defined bucket (Income, EMI/Debt, Expenses, Subscriptions, Savings, ...).
// type determines whether it adds to or subtracts from Net Surplus.
model MonthlyCategory {
  id          String              @id @default(cuid())
  householdId String
  household   Household           @relation(fields: [householdId], references: [id], onDelete: Cascade)
  name        String
  type        MonthlyCategoryType
  sortOrder   Int                 @default(0)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  lineItems MonthlyLineItem[]
  entries   MonthlyEntry[]

  @@index([householdId])
  @@map("monthly_categories")
}

// The recurring "plan" — e.g. "Home Loan EMI", "Netflix", "Daughter's SIP".
// plannedAmount here is just the current/latest value; it's snapshotted onto
// each MonthlyEntry when that month is generated, so edits here never rewrite
// history — they only change what future months pick up.
model MonthlyLineItem {
  id             String          @id @default(cuid())
  householdId    String
  household      Household       @relation(fields: [householdId], references: [id], onDelete: Cascade)
  categoryId     String
  category       MonthlyCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  name           String
  plannedAmount  Decimal
  // Which calendar months (1-12) this line applies to. Empty array = every month.
  // e.g. quarterly rent = [1,4,7,10]; annual insurance = [7].
  repeatMonths   Int[]           @default([])
  startYear      Int             // don't generate entries before this year/month —
  startMonth     Int             // i.e. whenever the line item was created.
  isActive       Boolean         @default(true) // "stopped" lines don't generate new entries but keep history
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  entries MonthlyEntry[]

  @@index([householdId])
  @@index([categoryId])
  @@map("monthly_line_items")
}

// One row in one month's sheet. Either generated from a MonthlyLineItem
// (lineItemId set, name/plannedAmount snapshotted at generation time) or a
// standalone one-off entry added directly into a specific month (lineItemId null).
model MonthlyEntry {
  id             String           @id @default(cuid())
  householdId    String
  household      Household        @relation(fields: [householdId], references: [id], onDelete: Cascade)
  categoryId     String
  category       MonthlyCategory  @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  lineItemId     String?
  lineItem       MonthlyLineItem? @relation(fields: [lineItemId], references: [id], onDelete: SetNull)
  year           Int
  month          Int              // 1-12
  name           String           // copied from line item at generation, or set directly for one-offs
  plannedAmount  Decimal
  actualAmount   Decimal?         // null until the user fills it in
  isSkipped      Boolean          @default(false) // skips this one occurrence without touching the line item
  notes          String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@unique([lineItemId, year, month])
  @@index([householdId, year, month])
  @@map("monthly_entries")
}
```

Add the reverse relations to `Household`:

```prisma
  monthlyCategories MonthlyCategory[]
  monthlyLineItems  MonthlyLineItem[]
  monthlyEntries    MonthlyEntry[]
```

Run `npx prisma db push` (or a migration, matching however this repo already handles schema changes).

## 2. Period helper — `lib/monthly-periods.ts` (new file)

Everything else depends on this being consistent, so centralize it:

```ts
export type Period = { year: number; month: number }; // month is 1-12

export function getCurrentPeriod(): Period {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getPreviousPeriod(): Period {
  const { year, month } = getCurrentPeriod();
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function getNextPeriod(): Period {
  const { year, month } = getCurrentPeriod();
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

// Months in the *current* calendar year that are already fully in the past
// (before Previous Month), shown read-only on the "Earlier Months" page.
// Empty in January, since Previous Month itself falls in the prior year then.
export function getEarlierMonthsOfCurrentYear(): Period[] {
  const { year: curYear, month: curMonth } = getCurrentPeriod();
  const prev = getPreviousPeriod();
  if (prev.year !== curYear) return [];
  const months: Period[] = [];
  for (let m = 1; m < prev.month; m++) months.push({ year: curYear, month: m });
  return months;
}

// Years fully archived to "Earlier Years". A year only counts as archived once
// its December is no longer reachable via "Previous Month" — i.e. normally
// every year before the current one, except in January, when last year's
// December is still the (editable) Previous Month.
export function getMostRecentArchivedYear(): number {
  const { year: curYear, month: curMonth } = getCurrentPeriod();
  return curMonth === 1 ? curYear - 2 : curYear - 1;
}

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
```

## 3. Month generation — `lib/monthly-generate.ts` (new file)

Called by every editable-month page before rendering. Idempotent: only creates rows that don't exist yet, never touches existing ones (that's what makes "planned amount changes apply forward only" work with zero extra bookkeeping).

```ts
import { prisma } from "@/lib/db";

export async function ensureMonthGenerated(householdId: string, year: number, month: number) {
  const lineItems = await prisma.monthlyLineItem.findMany({
    where: {
      householdId,
      isActive: true,
      OR: [{ startYear: { lt: year } }, { startYear: year, startMonth: { lte: month } }],
    },
  });

  const applicable = lineItems.filter(
    (li) => li.repeatMonths.length === 0 || li.repeatMonths.includes(month)
  );

  for (const li of applicable) {
    await prisma.monthlyEntry.upsert({
      where: { lineItemId_year_month: { lineItemId: li.id, year, month } },
      update: {},
      create: {
        householdId,
        categoryId: li.categoryId,
        lineItemId: li.id,
        year,
        month,
        name: li.name,
        plannedAmount: li.plannedAmount,
      },
    });
  }
}
```

(Prisma auto-names the compound unique `lineItemId_year_month` from `@@unique([lineItemId, year, month])` — verify the generated name matches after `prisma generate` and adjust if it differs.)

## 4. API routes

All routes: require a session (401 if none), require `session.householdId` (403 if none) — same pattern as `app/api/goals/route.ts`.

### `app/api/monthly/categories/route.ts`
- `GET` — list categories for the household, ordered by `sortOrder`.
- `POST` — body `{ name, type }` (`type` is `"INCOME" | "OUTFLOW"`). Zod-validate. `sortOrder` = current max + 1.

### `app/api/monthly/categories/[id]/route.ts`
- `PATCH` — body `{ name?, type?, sortOrder? }`. Confirm the category belongs to `session.householdId` first (404 if not).
- `DELETE` — only if it has no line items and no entries (return 400 with a clear message otherwise: "Remove its line items first.").

### `app/api/monthly/line-items/route.ts`
- `GET` — list line items for the household (optionally `?categoryId=`).
- `POST` — body `{ categoryId, name, plannedAmount, repeatMonths }` (`repeatMonths: number[]`, values 1-12, empty = every month). Set `startYear`/`startMonth` to the current period (`getCurrentPeriod()`) so it starts applying from now, not retroactively.

### `app/api/monthly/line-items/[id]/route.ts`
- `PATCH` — body `{ name?, plannedAmount?, repeatMonths?, isActive? }`. This only affects entries not yet generated — never touch existing `MonthlyEntry` rows here.
- `DELETE` — set `isActive: false` instead of a hard delete (existing entries keep their `lineItemId` via `onDelete: SetNull` only if you truly delete the row; prefer the soft-stop so history stays linked).

### `app/api/monthly/[year]/[month]/route.ts`
- `GET` — call `ensureMonthGenerated(householdId, year, month)`, then return all `MonthlyEntry` rows for that year/month (joined with category), grouped by category, plus the summary block described in §6.
- Next.js 15: `{ params }: { params: Promise<{ year: string; month: string }> }`, `const { year, month } = await params;`.

### `app/api/monthly/entries/route.ts`
- `POST` — add a one-off entry directly into a specific month: body `{ categoryId, year, month, name, plannedAmount, actualAmount? }`, `lineItemId` stays null.

### `app/api/monthly/entries/[id]/route.ts`
- `PATCH` — body `{ plannedAmount?, actualAmount?, isSkipped?, notes? }`. For entries linked to a line item, only `actualAmount`, `isSkipped`, and `notes` should be editable (planned amount changes belong on the line item, going forward) — `plannedAmount` is only editable when `lineItemId` is null (a one-off).
- `DELETE` — only allowed when `lineItemId` is null (one-offs). For recurring-linked entries, use `isSkipped` instead and return 400 if a delete is attempted on one.

### `app/api/monthly/years/route.ts`
- `GET` — distinct years present in `MonthlyEntry` that are `<= getMostRecentArchivedYear()`, for the "Earlier Years" picker list.

### `app/api/monthly/years/[year]/route.ts`
- `GET` — all 12 months of entries for that year (grouped by month, each grouped by category), plus a yearly summary (§6). 404/empty state if the year has no data, or if it's not actually archived yet (`year > getMostRecentArchivedYear()`).

## 5. Pages

All under the existing `app/(app)/` route group (so they share `ClientSidebar` via `app/(app)/layout.tsx` — no new layout needed).

- `app/(app)/monthly/current/page.tsx` — server component: `getCurrentPeriod()`, fetch via the logic in §4's `[year]/[month]` route (call the same helper directly, don't fetch your own API from a server component), render `<MonthlyTrackerClient period={...} entries={...} categories={...} editable={true} />`.
- `app/(app)/monthly/previous/page.tsx` — same, using `getPreviousPeriod()`. Also fully editable per the product decision.
- `app/(app)/monthly/next/page.tsx` — same, using `getNextPeriod()`. Also fully editable (this is how you get ahead).
- `app/(app)/monthly/earlier/page.tsx` — `getEarlierMonthsOfCurrentYear()`; if empty, show a simple "Nothing here yet this year" message. Otherwise fetch each month's entries and render `<MonthlyHistoryStack months={...} />` (read-only, all months stacked on one page, no per-item editing controls).
- `app/(app)/monthly/years/page.tsx` — list of archived years (from the years API/query), each a link to `/monthly/years/[year]`.
- `app/(app)/monthly/years/[year]/page.tsx` — validate `year <= getMostRecentArchivedYear()` (redirect to `/monthly/years` otherwise), fetch the full year, render `<MonthlyHistoryStack months={...} yearlySummary={...} />`.

### `components/MonthlyTrackerClient.tsx` (new, `"use client"`)

Editable single-month view, used by Current/Previous/Next:

- Summary bar at top: Total Income, Total Outflow, Net Surplus — each shown as Planned and Actual side by side (Actual total treats any entry with `actualAmount == null` as its `plannedAmount` for the purposes of the running total, so the number stays meaningful mid-month; a footnote/asterisk should note this).
- One section per category (grouped, in `sortOrder`), each a table: line name | Planned | Actual (editable input, saves on blur via `PATCH /api/monthly/entries/[id]`) | Skip toggle | notes.
- "Add category" control (name + Income/Outflow) → `POST /api/monthly/categories`.
- "Add line item" control per category (name, planned amount, repeat months — a simple 12-checkbox picker, "every month" as a shortcut that clears the array) → `POST /api/monthly/line-items`.
- "Add one-off entry" control per category (name, planned amount, optional actual) → `POST /api/monthly/entries`.
- Skipped entries render visibly struck-through/greyed and excluded from both Planned and Actual totals.

### `components/MonthlyHistoryStack.tsx` (new, `"use client"` not required — can be a server component since it's read-only)

- Renders a list of months (each with its category groups and entries, Planned + Actual, no inputs — plain text) stacked vertically, oldest or newest first (pick newest-first so the most recent locked month is nearest the top).
- If `yearlySummary` is passed, render it above the month list (Total Income / Total Outflow / Net Surplus for the whole year, Planned and Actual).

## 6. Summary calculation (used in both the API and the components)

For a given set of entries (one month, or a full year):

```
plannedIncome  = sum of plannedAmount where category.type === INCOME and not isSkipped
plannedOutflow = sum of plannedAmount where category.type === OUTFLOW and not isSkipped
actualIncome   = sum of (actualAmount ?? plannedAmount) where category.type === INCOME and not isSkipped
actualOutflow  = sum of (actualAmount ?? plannedAmount) where category.type === OUTFLOW and not isSkipped

netSurplusPlanned = plannedIncome - plannedOutflow
netSurplusActual  = actualIncome - actualOutflow
```

Put this in a small shared helper (e.g. `lib/monthly-summary.ts`) so the month API, year API, and both client components compute it identically.

## 7. Sidebar — `components/ClientSidebar.tsx`

Add a new labelled section between "Holdings" and "Settings":

```tsx
<p className="mt-4 px-4 text-xs font-semibold uppercase tracking-wide text-ink-2">
  Monthly Tracking
</p>
<Link href="/monthly/previous" className={linkClass("/monthly/previous")}>
  Previous Month
</Link>
<Link href="/monthly/current" className={linkClass("/monthly/current")}>
  Current Month
</Link>
<Link href="/monthly/next" className={linkClass("/monthly/next")}>
  Next Month
</Link>
<Link href="/monthly/earlier" className={linkClass("/monthly/earlier")}>
  Earlier Months
</Link>
<Link href="/monthly/years" className={linkClass("/monthly/years")}>
  Earlier Years
</Link>
```

(Keep the existing `linkClass` helper — `pathname === href` works fine here since these are distinct routes, no active-prefix matching needed.)

## What "done" looks like

- Sidebar shows a "Monthly Tracking" section with the 5 links above.
- Visiting Current Month for the first time auto-generates that month's rows from whatever recurring line items already apply — no manual "create this month" step.
- Editing a line item's planned amount changes Next Month but not Current/Previous, which already have their own snapshots.
- A line item with `repeatMonths: [1,4,7,10]` (quarterly) only produces entries in those months.
- Skipping one occurrence removes it from that month's totals without affecting the line item itself or other months.
- One-off entries can be added directly into Current/Previous/Next without becoming recurring.
- Previous, Current, and Next Month are all fully editable (Planned + Actual).
- Earlier Months (current year, locked) and Earlier Years (full past years, locked, with a yearly summary) both render correctly, including the January edge case where Earlier Months is empty and Earlier Years excludes the not-yet-fully-archived prior year.
- Each month's page shows Total Income / Total Outflow / Net Surplus for both Planned and Actual.
