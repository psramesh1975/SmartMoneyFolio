# CLAUDE.md — SmartMoneyFolio Working Conventions

*This file is the source of truth for how Claude works on this repo. It exists so a fresh chat/project session can pick up conventions and environment facts without depending on prior conversation history.*

---

## Roles & workflow

- **Ramesh** is product owner and primary developer.
- **Claude (chat)** inspects the live repo, asks clarifying questions on ambiguous decisions, and writes standalone `.md` spec files. Claude never writes code directly in this repo.
- **Claude Code** (separate session) receives the `.md` spec and implements it.
- Sequence: inspect repo → identify real codebase state → ask targeted questions for ambiguous decisions → write spec → hand off to Claude Code → build → review → flag drift → patch spec → re-implement (multiple sub-patch cycles per phase are normal).

**Before inspecting, always get a truly fresh clone — never reuse a prior local copy:**
```bash
rm -rf SmartMoneyFolio && git clone --depth 1 https://github.com/psramesh1975/SmartMoneyFolio.git
cd SmartMoneyFolio && git log -1 --format="%H %ci"
```
Confirm the logged commit matches what's actually deployed on Vercel before writing a spec against it. Stale local state has caused spec errors before.

**For diffs**, clone a second copy (e.g. `SmartMoneyFolio-orig2`) and run `diff -u` between the original and modified copies — don't diff against a working tree that's been edited in place.

**Spec format**: standalone instructions Claude Code can execute from, including an explicit "what done looks like" section. Task lists are always numbered. Specs must be grounded in the actual codebase, not assumptions from a feature brief — feature briefs have repeatedly assumed routes/fields/components that don't exist, so live inspection before speccing is non-negotiable, and every mismatch found gets flagged explicitly.

**Decisions**: get a clear product decision before speccing around any ambiguity. Locked decisions (below) are not re-opened unless Ramesh explicitly initiates a reversal.

---

## Environment facts

- **Repo**: `psramesh1975/SmartMoneyFolio`
- **Local working folder**: `C:\Project\Dev\SmartMoneyFolio` (intentionally outside OneDrive — avoids sync conflicts)
- **Domain**: `smartmoneyfolio.com` — Cloudflare DNS → Vercel, CNAME with proxy **disabled**
- **Admin accounts**: primary + `smartmoneyfolio@gmail.com` (second Super Admin)
- **Vercel MCP connector is non-functional for this account** — do all Vercel operations via the browser dashboard, not the MCP tool.
- **Prisma CLI does not read `.env.local`** — a separate `.env` file is required locally for `prisma db push` / `prisma generate`.
- **Test seeding**: `tsx prisma/seed.ts` and `scripts/seed-test-data.ts` require the `--env-file=.env.local` flag explicitly.
- **Securities master seeding** (`scripts/seed-securities.ts`) is permanently decoupled from the deploy pipeline — run manually, never wired into CI.

## Infrastructure gap — flag on every schema-change spec

Vercel's build runs `next build` only; Prisma Client regenerates via postinstall, but **no migration runs against the live Neon production DB**. Any `schema.prisma` change requires manually running the equivalent `ALTER TABLE` / `prisma db push` against production (Neon SQL Editor, or a machine with Neon network access) before or immediately after deploy — otherwise affected pages throw DB errors in production. There is no `prisma/migrations` history; the schema evolves entirely via `db push`.

## Locked architectural decisions — do not re-open without explicit reversal

- Strictly two-tier access: Super Admin vs. Client Household only — **no RBAC roles**. Household members are non-login profile labels, not separate accounts.
- Super Admin can hard-delete households (reversed from an earlier disable-only stance).
- Single base-currency convention throughout — **no live FX conversion**.
- No cron/batch for month rollover — Previous/Current/Next are computed labels from household timezone at request time.
- Securities master seeding is decoupled from the deploy pipeline (see above).
- Session dies on browser close — no "Remember me."
- Advisor/external reviewer access conflicts with the two-tier model — a product decision on approach (e.g. scoped share-link) is required before any scoping work begins.

---

## Pending task queue (update as items land)

1. ~~Super Admin platform page revamp~~ — CONFIRMED COMPLETE
2. Monthly Tracker page layout — content/layout has drifted from agreed design; needs a drift audit before any spec is written (sidebar styling is already done and is a separate, completed item)
3. Deactivated line items not clearing from Next Month — known bug, not yet specced
4. Infrastructure ownership migration — GitHub, Neon, Vercel moving to SmartMoneyFolio brand identity (new Gmail + `smartmoneyfolio.com` domain); sequence: GitHub transfer → Neon dump/restore → Vercel project recreation
5. Wallet feature — store finance-related identifiers (account numbers, loan numbers, NSC numbers, etc.) with masking; **all sensitive identifiers must be masked, never shown in plain text**; not yet specced
6. Secure Storage — encrypted vault for household documents (policies, loan papers, etc.); distinct from Wallet (files vs. identifiers); not yet specced
7. Asset Excel import revamp — template needs updating to match the post-Phase 9 Assets schema (SecuritiesMaster links, FD accrual fields, 7-category grouping); not yet specced
8. Liabilities Excel import — no import feature currently exists; not yet specced
9. Advisor/external reviewer access — conflicts with the two-tier model; needs a product decision before scoping (see locked decisions above)
10. Paid expert portfolio review service — not yet specced
11. Subscription/billing — not yet specced (schema has plain `subscriptionStatus`/`subscriptionExpiresAt` fields only, no billing logic)
12. First-time navigation/onboarding walkthrough — not yet specced
13. Support section/feature — not yet specced
14. Documentation — not yet specced

### Backlog (parked, no committed timeline)
- Yearly Planner — auto-derive "Paid" status from monthly actuals instead of a manual toggle
- FIRE (Financial Independence, Retire Early) tracking with progress/benchmarks; peer percentile comparison explicitly deferred
- Additional Main Dashboard widgets beyond current six charts + KPIs (TBD)

---

*Keep this file current: when a locked decision changes, a queue item ships, or an environment fact changes (new domain, new gotcha discovered), update it in the same PR/spec that causes the change.*
