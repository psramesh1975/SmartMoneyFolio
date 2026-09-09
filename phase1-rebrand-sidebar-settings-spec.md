# Smart Money Folio — Phase 1 Build Spec

**Give this whole file to Claude Code as one message: "Read this spec and implement it."**

Repo: `psramesh1975/SmartMoneyFolio`. This phase covers three things together, since they touch the same files:
1. Rebrand (WealthBridge → Smart Money Folio)
2. Design system refresh (colorful palette, larger type)
3. Client-side sidebar shell + new Settings page

---

## 1. Rebrand

Product name: **Smart Money Folio**
Tagline: **Your Money. Your Wealth. Your Future.**

Replace every occurrence of "WealthBridge" with "Smart Money Folio" in:
- `components/PlatformSidebar.tsx`
- `app/goals/page.tsx`
- `app/platform/page.tsx`
- `app/page.tsx` (also work the tagline into the hero copy naturally — don't just tack it on)
- `app/allocation/page.tsx`
- `app/signup/page.tsx`
- `app/login/page.tsx`
- `app/layout.tsx` — update the `title` metadata to `"Smart Money Folio — Your Money. Your Wealth. Your Future."`
- `app/accounts/page.tsx`
- `app/dashboard/page.tsx`
- `package.json` — update `"name"` field to `"smart-money-folio"`

---

## 2. Design system refresh

Current palette (cream background + navy + brass) reads as generic/dull and is being replaced. New direction: a **confident, colorful, modern financial palette** — jewel-tone accents on a clean white base, not pastel, not neon.

### Colors — replace the `colors` block in `tailwind.config.ts`

```ts
colors: {
  ink: "#161B33",        // near-black navy — primary text
  "ink-2": "#4B5170",    // muted slate — secondary text
  folio: "#2F5FD1",      // vivid royal blue — primary brand / nav / links
  "folio-light": "#5C82E0",
  growth: "#0FA968",     // vivid emerald — positive figures, growth, success states
  amber: "#F2A93B",      // warm amber — highlights, in-progress states
  coral: "#F2545B",      // vivid coral — alerts, suspended, negative figures
  paper: "#FFFFFF",
  "paper-2": "#F4F6FB",  // faint blue-white — section backgrounds, subtle separation
  line: "#E2E6F0",
},
```

Notes for whoever implements this:
- `rupee` and `dirham` color names existed before for currency-specific figures — replace their usage with `growth` (positive/INR-style figures) and `amber` (secondary currency figures) respectively, and remove the old `rupee`/`dirham` tokens. Search the codebase for `text-rupee`, `text-dirham`, `bg-rupee`, `bg-dirham`, `border-rupee`, `border-dirham` and swap to `growth`/`amber` equivalents.
- `span` (the old brass accent) → replace all usages (`text-span`, `bg-span`, `border-span`, `hover:text-span`, etc.) with `folio`.

### Typography — increase base sizes

Current type is too small throughout (a lot of `text-xs` used for real content, not just captions). Rules to apply app-wide, in every `.tsx` file under `app/` and `components/`:

- `text-xs` (12px) → only allowed for genuine micro-labels (e.g. a single badge like "ADMIN"). Everywhere it's used for actual data or body content, bump to `text-sm`.
- `text-sm` (14px) → bump to `text-base` (16px) for anything that's primary body content or table data a user reads closely (list items, form labels, table cells).
- Headings: `text-lg` → `text-xl`, `text-xl` → `text-2xl`, `text-2xl` → `text-3xl`.
- In `app/globals.css`, add a base font-size bump so the whole app scales up slightly:
  ```css
  html {
    font-size: 17px;
  }
  ```

Keep the existing font families (`Fraunces` for display, `Source Sans` for body) — that pairing itself is fine, it's the sizing and color that were the actual complaint.

---

## 3. Client sidebar shell

### Why
`app/dashboard/page.tsx`, `app/goals/page.tsx`, `app/allocation/page.tsx`, and `app/accounts/page.tsx` each currently render their **own separate header** with duplicated nav links. This is why it feels inconsistent. The admin side already solved this correctly with `PlatformLayout` + `PlatformSidebar` — mirror that exact pattern for the client side.

### Step A: Create a route group so these pages share one layout without changing their URLs

Move these four existing folders:
```
app/dashboard  →  app/(app)/dashboard
app/goals      →  app/(app)/goals
app/allocation →  app/(app)/allocation
app/accounts   →  app/(app)/accounts
```
(The parentheses mean Next.js does NOT include `(app)` in the URL — `/dashboard` stays `/dashboard`, etc. This is a standard Next.js App Router pattern, same idea as how `app/platform` already works, just applied to routes that don't share a URL prefix.)

### Step B: Create `app/(app)/layout.tsx`

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ClientSidebar from "@/components/ClientSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) {
    redirect(session.isPlatformOwner ? "/platform" : "/login");
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <ClientSidebar isPlatformOwner={session.isPlatformOwner} />
      <main className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
```

### Step C: Create `components/ClientSidebar.tsx`

Mirror `components/PlatformSidebar.tsx`'s structure exactly (same active-link highlighting pattern, same `LogoutButton` placement), with these links:
- Dashboard → `/dashboard`
- Goals → `/goals`
- Targets → `/allocation`
- Holdings → `/accounts`
- Settings → `/settings`
- If `isPlatformOwner` is true, also show a link to `/platform` labeled "Admin"

Brand header inside the sidebar: "Smart Money Folio" (font-display, folio color), with the household name underneath (same treatment `PlatformSidebar` uses for "Admin").

### Step D: Strip the duplicate headers out of the four moved pages

In each of `dashboard/page.tsx`, `goals/page.tsx`, `allocation/page.tsx`, `accounts/page.tsx`: remove the `<header>...</header>` block and the outer `<main className="min-h-screen bg-paper">` wrapper (the layout now provides both). What's left should just be the page's actual content (e.g. in `dashboard/page.tsx`, that's the `<section className="mx-auto max-w-5xl px-6 py-10">...</section>` block onward) wrapped directly in a fragment or a plain `<section>`.

Double check `app/accounts/page.tsx` and `components/AccountsClient.tsx`, `components/GoalsClient.tsx`, `components/AllocationClient.tsx` for the same "Back to dashboard" header pattern seen in the accounts screen — remove those too, since the sidebar now provides navigation.

---

## 4. New Settings page

### Route: `app/(app)/settings/page.tsx`

A server component that loads the current user's household + their own `FamilyMember` record (the one linked via `linkedUserId`), and renders a client component form.

Two sections on the page:
1. **Profile** — edit name, city, address, operational currency, residency status (the fields already on `FamilyMember` for the "Self" member).
2. **Password** — current password, new password, confirm new password.

### New component: `components/SettingsClient.tsx`

`"use client"` component with two separate forms (profile save, password save), each with their own loading/success/error state — don't combine them into one submit, since they're logically separate actions and a user might only want to do one.

### New API route: `app/api/account/profile/route.ts`

```ts
PATCH — body: { name, city, address, operationalCurrency, residencyStatus }
```
- Require a session; 401 if none.
- Find the FamilyMember where `linkedUserId === session.userId`. 404 if not found (shouldn't happen for a normal client login, but handle it).
- Zod-validate the body (reuse the `CURRENCY_CODES` enum from `lib/currencies.ts` for `operationalCurrency`, and the existing `Residency` values for `residencyStatus`).
- Update and return the updated record.

### New API route: `app/api/account/password/route.ts`

```ts
PATCH — body: { currentPassword, newPassword }
```
- Require a session; 401 if none.
- Load the `User` by `session.userId`.
- Verify `currentPassword` against the stored hash with `verifyPassword` from `lib/auth.ts`. If it doesn't match, return 400 with `{ error: "Current password is incorrect." }` — do not reveal anything else.
- Zod-validate `newPassword` with `.min(8)`, matching the same rule used at signup.
- Hash the new password with `hashPassword` and update the `User` record.
- Do NOT log the user out or rotate the session — just confirm success.

---

## What "done" looks like

- Every page (main, login, signup, admin, dashboard, goals, targets, holdings) shows "Smart Money Folio" and the new color palette — no more "WealthBridge", no more cream/brass.
- Visiting `/dashboard`, `/goals`, `/allocation`, `/accounts`, and the new `/settings` all show the same left sidebar, with the current page highlighted, and no duplicate per-page headers.
- `/settings` lets a client update their profile fields and change their password, with clear success/error feedback on each form independently.
- The admin side (`/platform`) is untouched in this phase — that's Phase 3.
