import { formatCurrency } from "@/lib/format-currency";
import type { UpcomingAutoDebit } from "@/lib/dashboard-data";

const typeBadgeClass: Record<UpcomingAutoDebit["type"], string> = {
  EMI: "border-rose-100 bg-rose-50 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-400",
  SIP: "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-cyan-500/20 dark:bg-emerald-500/10 dark:text-cyan-400",
};

// "3rd", "21st", "22nd" etc. — dueDay is a day-of-month, not a countdown, so
// this is how it reads naturally in a list ("Due on the 3rd").
function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// Chronological (already sorted by getUpcomingAutoDebits) list of EMIs/SIPs
// due in the next 15 days. Empty whenever nothing has an emiDueDay/sipDueDay
// set yet — there's no edit UI for those fields, so this card is honest
// about showing nothing rather than guessing a date.
export default function UpcomingDebitsCard({
  debits,
  baseCurrency,
}: {
  debits: UpcomingAutoDebit[];
  baseCurrency: string;
}) {
  const total = debits.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div
      data-testid="upcoming-debits-list"
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upcoming debits</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Next 15 days</p>
        </div>
        <p className="shrink-0 text-sm font-black text-slate-900 dark:text-white">
          {formatCurrency(total, baseCurrency)}
        </p>
      </div>

      {debits.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          No EMIs or SIPs with a due day recorded fall in the next 15 days.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {debits.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{d.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${typeBadgeClass[d.type]}`}
                  >
                    {d.type}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Due on the {ordinal(d.dueDay)}
                    {d.memberName ? ` · ${d.memberName}` : ""}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">
                {formatCurrency(d.amount, baseCurrency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
