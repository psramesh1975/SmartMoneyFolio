# Smart Money Folio — Phase 5.1 Patch: Monthly Base + Base/Planned/Actual

**Give this whole file to Claude Code as one message: "Read this spec and apply it as a patch to
the Monthly Tracking feature you already built." If any names below don't match what you actually
built in Phase 5, adapt to the real names — the intent is what matters.**

This patches two things found missing after reviewing the real spreadsheet (`Base_Tracker.xlsx`)
against the first build:

1. Monthly sheets are **Base | Planned | Actual** (three columns), not just Planned/Actual.
2. Categories and recurring line items should be set up **once, deliberately, on a dedicated
   "Monthly Base" page** — not created ad hoc from inside a month view.

---

## 1. Schema changes

On `MonthlyLineItem`:
- Rename `plannedAmount` → **`baseAmount`**. This is the steady reference figure (e.g. the full
  EMI, the standard SIP amount) set once on the Monthly Base page. Editing it only affects entries
  not yet generated (unchanged rule from Phase 5).

On `MonthlyEntry`:
- Keep the snapshot of the line item's value at generation time, but rename it **`baseAmount`**
  (was `plannedAmount`) — this is the reference number, shown but not directly editable inline.
- Add a new field **`plannedAmount`** (Decimal, nullable-false, defaults to `baseAmount` at
  generation time). This is what the user can freely edit for that specific month — e.g. the
  pre-EMI amount that's genuinely different from the full loan Base — without touching the line
  item's `baseAmount` or affecting any other month.
- `actualAmount` is unchanged (nullable until filled).
- One-off entries (no `lineItemId`): set `baseAmount` and `plannedAmount` to the same value when
  created (there's no separate "base" for something one-time), but still allow `plannedAmount` to
  diverge later if edited.

```prisma
model MonthlyLineItem {
  // ...unchanged...
  baseAmount     Decimal   // was plannedAmount
  // ...unchanged...
}

model MonthlyEntry {
  // ...unchanged...
  baseAmount     Decimal   // was plannedAmount — snapshot from the line item, reference only
  plannedAmount  Decimal   // NEW — this month's actual plan, defaults to baseAmount, freely editable
  actualAmount   Decimal?
  // ...unchanged...
}
```

Update `ensureMonthGenerated` (`lib/monthly-generate.ts`) to set both fields on create:

```ts
create: {
  householdId,
  categoryId: li.categoryId,
  lineItemId: li.id,
  year,
  month,
  name: li.name,
  baseAmount: li.baseAmount,
  plannedAmount: li.baseAmount, // starting point; user can edit independently from here
},
```

---

## 2. API changes

### `app/api/monthly/entries/[id]/route.ts`
- `PATCH` now accepts `plannedAmount` on **any** entry, recurring-linked or not — this was
  previously restricted to one-offs; lift that restriction. `baseAmount` itself is never
  user-editable through this route (it's a snapshot); only `plannedAmount`, `actualAmount`,
  `isSkipped`, `notes`.

### `app/api/monthly/line-items/*`
- Field renamed in request/response bodies: `plannedAmount` → `baseAmount`. No other behavior
  change (still forward-only, still only affects ungenerated months).

### Summary calculation (`lib/monthly-summary.ts`)
- Still computed from `plannedAmount` / `actualAmount` (unchanged — Base is a reference value, not
  part of the Income/Outflow/Net Surplus math). No change needed here, just confirming Base
  doesn't get summed into the top totals.

---

## 3. New page: Monthly Base — `app/(app)/monthly/base/page.tsx`

This is the setup screen, used at the start of each year (or whenever something recurring
changes) — home loan, son's school fee, son's bus fee, daughter's fee, SIPs, rent, subscriptions,
etc. This is where **all** category and line-item creation/editing now happens:

- List of categories (name + Income/Outflow badge), each expandable to show its line items.
- "+ Add category" (name, Income/Outflow) — same `POST /api/monthly/categories` as before.
- Per category, "+ Add line item" (name, Base amount, repeat months picker) —
  `POST /api/monthly/line-items`, using `baseAmount` in the payload now.
- Each line item is editable inline (name, Base amount, repeat months, active/stopped toggle) —
  `PATCH /api/monthly/line-items/[id]`.
- No Planned/Actual here at all — this page only ever deals in Base amounts. It's the template,
  not a month.

### Remove from month pages
`components/MonthlyTrackerClient.tsx` (Current/Previous/Next): remove the "+ Add category" and
"+ Add recurring line" controls entirely. Keep:
- "+ One-off" (still added directly into a specific month — that's genuinely month-specific, not
  part of the Base setup).
- Per-line display: **Base** (read-only, greyed/muted text) — **Planned** (editable input) —
  **Actual** (editable input) — skip toggle — notes.
- If a category has no line items yet (nothing set up on Monthly Base for it), show "Nothing set
  up in Monthly Base yet for this category" instead of an inline add-line-item control, with a
  link to `/monthly/base`.

---

## 4. Sidebar — `components/ClientSidebar.tsx`

Add "Monthly Base" as the first link in the Monthly Tracking section:

```tsx
<p className="mt-4 px-4 text-xs font-semibold uppercase tracking-wide text-ink-2">
  Monthly Tracking
</p>
<Link href="/monthly/base" className={linkClass("/monthly/base")}>
  Monthly Base
</Link>
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

---

## What "done" looks like

- `/monthly/base` lists categories and their line items, all editable there, with Base amounts
  only (no Planned/Actual on this page).
- Current/Previous/Next Month pages show three values per line: Base (greyed, reference only),
  Planned (editable), Actual (editable) — editing Planned never changes Base.
- A category with nothing set up in Monthly Base shows a prompt pointing to `/monthly/base`
  instead of letting you add line items inline.
- Sidebar shows 6 links under "Monthly Tracking", Monthly Base first.
