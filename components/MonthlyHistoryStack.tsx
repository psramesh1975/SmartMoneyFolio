import type { MonthlySummary } from "@/lib/monthly-summary";
import type { MonthlyMonthPayload } from "@/lib/monthly-types";
import MonthHistoryCard from "@/components/MonthHistoryCard";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

// Used by both /monthly/earlier and /monthly/years/[year] — a stack of
// expandable month cards, newest first (the pages pass months already
// reversed into that order). Stays a server component; each card is its own
// client island for the expand/collapse interaction.
export default function MonthlyHistoryStack({
  months,
  yearlySummary,
  currency,
}: {
  months: MonthlyMonthPayload[];
  yearlySummary?: MonthlySummary;
  currency: string;
}) {
  return (
    <div className="space-y-4">
      {yearlySummary && (
        <div className="border border-line bg-paper-2 p-4">
          <h2 className="font-display text-xl text-ink">Year total</h2>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
            <span>
              Total Inflow: {currency} {fmt(yearlySummary.actualIncome)}
            </span>
            <span>
              Total Outflow: {currency} {fmt(yearlySummary.actualOutflow)}
            </span>
            <span
              className={
                yearlySummary.netSurplusActual >= 0
                  ? "font-semibold text-growth"
                  : "font-semibold text-coral"
              }
            >
              Net Saved: {currency} {fmt(yearlySummary.netSurplusActual)}
            </span>
          </div>
        </div>
      )}

      {months.map((m) => (
        <MonthHistoryCard key={`${m.year}-${m.month}`} payload={m} currency={currency} />
      ))}
    </div>
  );
}
