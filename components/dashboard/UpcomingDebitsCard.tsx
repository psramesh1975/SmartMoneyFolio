import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";
import type { UpcomingAutoDebit } from "@/lib/dashboard-data";

// A debit due within this many days gets the amber "Due in N days" urgency
// treatment; further out it reads as a plain "Auto-debit • DD Mon" line —
// matches the mockup's example (an item 4 days out shown in amber, others
// further out shown in slate).
const URGENT_WITHIN_DAYS = 5;

function daysUntil(dueDate: string, now: Date): number {
  const todayMidnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((new Date(dueDate).getTime() - todayMidnightUTC) / (24 * 60 * 60 * 1000));
}

function formatDueDate(dueDate: string): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(dueDate));
}

// Chronological (already sorted by getUpcomingAutoDebits) list of EMIs/SIPs
// due in the next 15 days. Empty whenever nothing has an emiDueDay/sipDueDay
// set yet — there's no edit UI for those fields, so this card is honest
// about showing nothing rather than guessing a date.
export default function UpcomingDebitsCard({
  debits,
  baseCurrency,
  currentMonthLabel,
}: {
  debits: UpcomingAutoDebit[];
  baseCurrency: string;
  currentMonthLabel: string;
}) {
  const total = debits.reduce((sum, d) => sum + d.amount, 0);
  const now = new Date();

  return (
    <div
      data-testid="upcoming-debits-list"
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="font-bold text-amber-500 dark:text-amber-400">📅</span>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Upcoming Debits ({currentMonthLabel})
          </h4>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-slate-400 dark:text-slate-500">
          Total: {formatCurrency(total, baseCurrency)}
        </span>
      </div>

      {debits.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          No EMIs or SIPs with a due day recorded fall in the next 15 days.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {debits.map((d) => {
            const days = daysUntil(d.dueDate, now);
            const urgent = days <= URGENT_WITHIN_DAYS;
            return (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800/60 dark:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{d.title}</p>
                  <p
                    className={`text-[10px] font-semibold ${
                      urgent ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {urgent
                      ? `Due in ${days} day${days === 1 ? "" : "s"} • ${formatDueDate(d.dueDate)}`
                      : `Auto-debit • ${formatDueDate(d.dueDate)}`}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                  {formatCurrency(d.amount, baseCurrency)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/monthly/current"
        className="mt-4 block w-full rounded-xl bg-slate-100 py-2 text-center text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
      >
        View All Monthly Commitments →
      </Link>
    </div>
  );
}
