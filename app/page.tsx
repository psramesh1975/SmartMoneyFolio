import Link from "next/link";

function BridgeMark() {
  return (
    <svg viewBox="0 0 640 180" className="w-full max-w-2xl" aria-hidden="true">
      <line x1="20" y1="150" x2="620" y2="150" stroke="#161B33" strokeWidth="2" />
      <rect x="60" y="60" width="14" height="90" fill="#161B33" />
      <rect x="566" y="60" width="14" height="90" fill="#161B33" />
      {Array.from({ length: 13 }).map((_, i) => {
        const x = 90 + i * 38;
        return (
          <line
            key={i}
            x1={x}
            y1="150"
            x2="320"
            y2="40"
            stroke="#2F5FD1"
            strokeWidth="1.5"
            opacity={0.85}
          />
        );
      })}
      <line x1="67" y1="60" x2="573" y2="60" stroke="#2F5FD1" strokeWidth="2.5" />
      <circle cx="320" cy="40" r="5" fill="#2F5FD1" />
      <text x="30" y="40" fontFamily="var(--font-jakarta)" fontSize="15" fill="#F2A93B" fontWeight={600}>
        Home
      </text>
      <text x="560" y="40" fontFamily="var(--font-jakarta)" fontSize="15" fill="#0FA968" fontWeight={600}>
        Away
      </text>
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-canvas">
      <header className="border-b border-slate-200/80 dark:border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Smart Money Folio</span>
          <nav className="flex items-center gap-6 text-base">
            <Link href="/login" className="focus-ring text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-lime-400">
              Log in
            </Link>
            <Link
              href="/signup"
              className="focus-ring border border-slate-900 px-4 py-2 text-slate-900 hover:border-blue-600 hover:text-blue-600 dark:border-white dark:text-white dark:hover:border-lime-400 dark:hover:text-lime-400"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10 pt-16">
        <p className="text-base font-semibold uppercase tracking-wide text-blue-600 dark:text-lime-400">
          Your Money. Your Wealth. Your Future.
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white">
          One ledger for money that lives in two countries.
        </h1>
        <p className="mt-6 max-w-xl text-xl text-slate-500 dark:text-slate-400">
          Replace the spreadsheet. Track income, recurring costs, remittances,
          and family wealth in one place — built for households whose money
          crosses a border every month, in any pair of currencies.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/signup"
            className="focus-ring bg-slate-900 px-6 py-3 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Create your household
          </Link>
          <Link
            href="/login"
            className="focus-ring text-slate-900 underline decoration-slate-200/80 underline-offset-4 hover:text-blue-600 dark:text-white dark:decoration-slate-800 dark:hover:text-lime-400"
          >
            I already have an account
          </Link>
        </div>

        <div className="mt-16 flex justify-center">
          <BridgeMark />
        </div>
      </section>

      <section className="border-t border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-white/5">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-3">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dual-currency cash flow</h2>
            <p className="mt-3 text-base leading-relaxed text-slate-500 dark:text-slate-400">
              Fixed income in one currency, recurring costs like rent and
              insurance, and loan payments in another — planned together
              instead of across six tabs.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Consolidated family wealth</h2>
            <p className="mt-3 text-base leading-relaxed text-slate-500 dark:text-slate-400">
              Mutual funds, deposits, bonds, retirement accounts, and pensions
              across every family member, tracked against one lifetime target.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">One household, many members</h2>
            <p className="mt-3 text-base leading-relaxed text-slate-500 dark:text-slate-400">
              Tag accounts and goals to a spouse or child who never needs to log in —
              or invite them with view-only access when they're ready.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/80 px-6 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Smart Money Folio — Your Money. Your Wealth. Your Future.
      </footer>
    </main>
  );
}
