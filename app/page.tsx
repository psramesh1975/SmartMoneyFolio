import Link from "next/link";

function BridgeMark() {
  return (
    <svg viewBox="0 0 640 180" className="w-full max-w-2xl" aria-hidden="true">
      <line x1="20" y1="150" x2="620" y2="150" stroke="#12203A" strokeWidth="2" />
      <rect x="60" y="60" width="14" height="90" fill="#12203A" />
      <rect x="566" y="60" width="14" height="90" fill="#12203A" />
      {Array.from({ length: 13 }).map((_, i) => {
        const x = 90 + i * 38;
        return (
          <line
            key={i}
            x1={x}
            y1="150"
            x2="320"
            y2="40"
            stroke="#B8823A"
            strokeWidth="1.5"
            opacity={0.85}
          />
        );
      })}
      <line x1="67" y1="60" x2="573" y2="60" stroke="#B8823A" strokeWidth="2.5" />
      <circle cx="320" cy="40" r="5" fill="#B8823A" />
      <text x="30" y="40" fontFamily="var(--font-source-sans)" fontSize="15" fill="#8A4B2E" fontWeight={600}>
        Home
      </text>
      <text x="560" y="40" fontFamily="var(--font-source-sans)" fontSize="15" fill="#3C6E52" fontWeight={600}>
        Away
      </text>
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="font-display text-xl italic text-ink">WealthBridge</span>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/login" className="text-ink hover:text-span focus-ring">
              Log in
            </Link>
            <Link
              href="/signup"
              className="border border-ink px-4 py-2 text-ink hover:border-span hover:text-span focus-ring"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10 pt-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-dirham">
          Working title — the name can change later
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.1] text-ink">
          One ledger for money that lives in two countries.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-2">
          Replace the spreadsheet. Track income, recurring costs, remittances,
          and family wealth in one place — built for households whose money
          crosses a border every month, in any pair of currencies.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/signup"
            className="bg-ink px-6 py-3 text-paper hover:bg-ink-2 focus-ring"
          >
            Create your household
          </Link>
          <Link href="/login" className="text-ink underline decoration-line underline-offset-4 hover:text-span focus-ring">
            I already have an account
          </Link>
        </div>

        <div className="mt-16 flex justify-center">
          <BridgeMark />
        </div>
      </section>

      <section className="border-t border-line bg-paper-2">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-3">
          <div>
            <h2 className="font-display text-xl text-ink">Dual-currency cash flow</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              Fixed income in one currency, recurring costs like rent and
              insurance, and loan payments in another — planned together
              instead of across six tabs.
            </p>
          </div>
          <div>
            <h2 className="font-display text-xl text-ink">Consolidated family wealth</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              Mutual funds, deposits, bonds, retirement accounts, and pensions
              across every family member, tracked against one lifetime target.
            </p>
          </div>
          <div>
            <h2 className="font-display text-xl text-ink">One household, many members</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              Tag accounts and goals to a spouse or child who never needs to log in —
              or invite them with view-only access when they're ready.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-6 py-8 text-center text-xs text-ink-2">
        WealthBridge — a working title, changeable any time.
      </footer>
    </main>
  );
}
