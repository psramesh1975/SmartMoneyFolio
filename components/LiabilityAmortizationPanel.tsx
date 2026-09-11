import { computeAmortization } from "@/lib/amortization";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

// The "Inspect" breakdown — monthly interest/principal split + payoff
// progress bar — shared by the dashboard's DebtOverview and the full
// /liabilities page's category tables, so there's exactly one place that
// renders this instead of two copies drifting apart.
export default function LiabilityAmortizationPanel({
  currency,
  outstandingBalance,
  originalAmount,
  interestRate,
  emiAmount,
  targetPayoffDate,
}: {
  currency: string;
  outstandingBalance: string;
  originalAmount: string | null;
  interestRate: string | null;
  emiAmount: string | null;
  targetPayoffDate: string | null; // ISO date string, or null
}) {
  const breakdown = computeAmortization({
    outstandingBalance: Number(outstandingBalance),
    originalAmount: originalAmount ? Number(originalAmount) : null,
    interestRate: interestRate ? Number(interestRate) : null,
    emiAmount: emiAmount ? Number(emiAmount) : null,
    targetPayoffDate: targetPayoffDate ? new Date(targetPayoffDate) : null,
  });

  return (
    <div>
      {breakdown.isAmortizing ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Monthly interest</p>
            <p className="font-medium text-rose-600 dark:text-rose-400">
              {currency} {fmt(breakdown.monthlyInterest ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Monthly principal</p>
            <p className="font-medium text-emerald-600 dark:text-cyan-400">
              {currency} {fmt(breakdown.monthlyPrincipal ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Months remaining</p>
            <p className="font-medium text-slate-900 dark:text-white">{breakdown.monthsRemaining ?? "—"}</p>
          </div>
        </div>
      ) : (
        <p className="text-slate-500 dark:text-slate-400">Running balance — no interest.</p>
      )}
      {breakdown.percentPaidOff !== null ? (
        <div className="mt-2 max-w-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Paid off</span>
            <span>{Math.round(breakdown.percentPaidOff)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
            <div
              className="h-full bg-blue-600 dark:bg-lime-400"
              style={{ width: `${breakdown.percentPaidOff}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Add original loan amount to track payoff progress.
        </p>
      )}
    </div>
  );
}
