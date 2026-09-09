# Smart Money Folio — Phase 3 Build Spec: Admin Rework

**Give this whole file to Claude Code as one message: "Read this spec and implement it."**

Repo: `psramesh1975/SmartMoneyFolio`. This phase fixes three related problems on the admin (`/platform`) side:
1. Remove the Admin/Editor/Viewer role concept entirely (obsolete now that each household has exactly one login).
2. Split the admin area into a real stats **Dashboard** and a separate **Client Management** page, fixing the current broken sidebar link.
3. Build the actual admin dashboard stats.

Client-side (`/dashboard`, `/goals`, `/allocation`, `/accounts`, `/settings`) is unaffected except where noted in Step 1.

---

## Step 1: Remove the Role concept

### Why
Roles (ADMIN/EDITOR/VIEWER) were designed for multi-user households. That model was dropped — each household has exactly one login — so a per-user role selector no longer means anything. `VIEWER` is still used to gate write access in a few API routes; removing roles means every household's single login gets full read/write access to its own data (no read-only mode).

### Schema (`prisma/schema.prisma`)
- Remove the `role` field from `User`.
- Remove the `Role` enum entirely (`ADMIN | EDITOR | VIEWER`).
- Generate and apply a migration for this.

### Session (`lib/auth.ts`)
- Remove `role: "ADMIN" | "EDITOR" | "VIEWER"` from the session type.
- Update `createSession(...)` calls accordingly (remove the `role` argument).

### Auth routes
- `app/api/auth/signup/route.ts` — remove `role: "ADMIN"` from both the `tx.user.create` call and the `createSession` call.
- `app/api/auth/login/route.ts` — remove `role: user.role` from the session payload.

### Permission-gated API routes — remove the VIEWER check, keep everything else identical
- `app/api/goals/route.ts` — remove the `if (session.role === "VIEWER") { ... }` block.
- `app/api/allocation-targets/route.ts` — same.
- `app/api/accounts/route.ts` — same.
- `app/api/accounts/[id]/route.ts` — same.

### Client pages/components — remove `canEdit` plumbing (always-editable now)
- `app/(app)/goals/page.tsx`, `app/(app)/allocation/page.tsx`, `app/(app)/accounts/page.tsx` — stop passing `canEdit={session.role !== "VIEWER"}`.
- `components/GoalsClient.tsx`, `components/AllocationClient.tsx`, `components/AccountsClient.tsx` — remove the `canEdit` prop from the type and component signature, and remove the `{canEdit && (...)}` conditionals — the wrapped content should now always render.
- `app/(app)/dashboard/page.tsx` — the `users: { select: { id: true, email: true, role: true } }` query no longer needs `role`; drop it from the `select`.

### Admin-side cleanup (role-specific pieces only — the rest of these files is handled in Steps 2–3)
- Delete `app/api/platform/users/[userId]/role/route.ts` entirely (the whole route).
- `components/PlatformClientsClient.tsx` — remove `changeRole`, the `<select>` role dropdown, and `role` from the `UserRow` type.
- Anywhere a Prisma query selects `role` on `users` for platform purposes (`app/platform/page.tsx`, `app/api/platform/clients/route.ts`) — drop `role` from the `select`.

---

## Step 2: Fix the admin sidebar + split into two real pages

### Why
`components/PlatformSidebar.tsx` already links to `/platform` ("Dashboard") and `/platform/clients` ("User Management") — but only `app/platform/page.tsx` exists, and it currently renders the client list (not stats). `/platform/clients` 404s because that route was never created. There's also a duplicate header: `app/platform/page.tsx` renders its own `<header>` + `<main className="min-h-screen bg-paper">` on top of what `app/platform/layout.tsx` (which wraps `PlatformSidebar`) already provides.

### Step 2a: Rewrite `app/platform/page.tsx` to be the real stats Dashboard
Remove the `<header>` and outer `<main className="min-h-screen bg-paper">` wrapper (the layout already provides both, same fix already applied on the client side in Phase 1). Content becomes the dashboard stats built in Step 3.

### Step 2b: Create `app/platform/clients/page.tsx`
Move the existing client-list content out of `app/platform/page.tsx` into this new file (same query, same `<PlatformClientsClient>` usage), also stripped of the duplicate `<header>`/`<main>` wrapper — just a `<section>` with the heading "Clients" and the list.

### Step 2c: Create `app/api/platform/clients/route.ts` check
This file already exists and already returns the household list correctly — no change needed here beyond the `role` field removal from Step 1.

### Step 2d: Update `components/PlatformSidebar.tsx`
- Rename the "User Management" link label to **"Client Management"** (the users-with-roles framing is gone; it's a household list now) — href stays `/platform/clients`, which now resolves correctly.
- No other structural changes to the sidebar.

---

## Step 3: Build the admin dashboard stats

### Route: `app/platform/page.tsx` (rewritten per Step 2a)

Server component. Query `prisma.household` for everything needed and compute:

1. **New signups**
   - Count of households with `createdAt` in the last 7 days.
   - Count of households with `createdAt` in the last 30 days.
   - Total households (all-time).

2. **Clients by location**
   - There's no dedicated region/country field on `Household`, and adding one would require a signup-form change that's out of scope for this phase. Instead, derive this from the existing data: for each household, find its "Self" `FamilyMember` (`relationship === "Self"`) and use that member's `city` field (already required at signup). Group households by that city string and show a simple count-per-city list, sorted descending, with an "Unspecified" bucket for any household missing it.
   - Label this section "Clients by location" (not "by region") since it's city-level, not country-level.

3. **Free vs. Subscription split**
   - `Household.subscriptionStatus` already exists (`FREE | TRIAL | PAID`). Group and count by this field directly — no schema change needed.

### Layout
Four to five small stat cards/sections in a grid (reuse the existing card visual language — white background, `border border-line`, consistent with `PlatformClientsClient`'s existing card style):
- New signups (7d / 30d / all-time) — one card, three numbers.
- Clients by location — a short list, city name + count, top 8 by count.
- Free vs. Subscription — a short list, status + count (and % of total if easy).

Keep this a plain server-rendered page (no client component / no interactivity needed) since none of these numbers are edited in place.

### Query approach
A single `prisma.household.findMany` with `select: { id, createdAt, subscriptionStatus, familyMembers: { where: { relationship: "Self" }, select: { city: true } } }` is enough to compute all three sections in-memory — no need for separate grouped queries.

---

## What "done" looks like

- No `Role` enum, no `role` field on `User`, no role dropdown anywhere. Every household login has full read/write access to its own data.
- `/platform` shows real stats: new signups, clients by location, Free vs. Subscription split — not the client list.
- `/platform/clients` shows the client list (suspend/reactivate, no more role column) — and the sidebar's "Client Management" link goes there without a 404.
- No duplicate headers on either admin page; both rely solely on `PlatformSidebar` + `app/platform/layout.tsx`.
- Client-side pages (`/dashboard`, `/goals`, `/allocation`, `/accounts`) behave exactly as before except that every login can now always edit (no more VIEWER-gated read-only state).
