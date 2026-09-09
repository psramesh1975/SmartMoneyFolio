import { Fragment } from "react";
import { MONTH_LABELS } from "@/lib/monthly-periods";
import type { MonthlySummary } from "@/lib/monthly-summary";
import type { MonthlyMonthPayload } from "@/lib/monthly-types";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

function SummaryGrid({ summary, currency }: { summary: MonthlySummary; currency: string }) {
  const rows: [string, number, number][] = [
    ["Income", summary.plannedIncome, summary.actualIncome],
    ["Outflow", summary.plannedOutflow, summary.actualOutflow],
    ["Net Surplus", summary.netSurplusPlanned, summary.netSurplusActual],
  ];
  return (
    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
      <div className="font-medium text-ink-2">&nbsp;</div>
      <div className="font-medium text-ink-2">Planned</div>
      <div className="font-medium text-ink-2">Actual</div>
      {rows.map(([label, planned, actual]) => (
        <Fragment key={label}>
          <div className="text-ink">{label}</div>
          <div className="text-ink">{currency} {fmt(planned)}</div>
          <div className="text-ink">{currency} {fmt(actual)}</div>
        </Fragment>
      ))}
    </div>
  );
}

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
    <div className="space-y-8">
      {yearlySummary && (
        <div className="border border-line bg-white p-4">
          <h2 className="font-display text-xl text-ink">Year total</h2>
          <SummaryGrid summary={yearlySummary} currency={currency} />
        </div>
      )}

      {months.map((m) => (
        <div key={`${m.year}-${m.month}`} className="border border-line bg-white p-4">
          <h3 className="font-display text-lg text-ink">
            {MONTH_LABELS[m.month - 1]} {m.year}
          </h3>
          <SummaryGrid summary={m.summary} currency={currency} />
          <p className="mt-2 text-xs text-ink-2">
            * Actual totals count any line without an entered actual as its planned amount.
          </p>

          {m.categories.length === 0 ? (
            <p className="mt-3 text-sm text-ink-2">No entries.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {m.categories.map((c) => (
                <div key={c.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
                    {c.name}
                  </p>
                  <table className="mt-1 w-full text-sm">
                    <thead>
                      <tr className="text-left text-ink-2">
                        <th className="py-1 font-medium">Line</th>
                        <th className="py-1 text-right font-medium">Base</th>
                        <th className="py-1 text-right font-medium">Planned</th>
                        <th className="py-1 text-right font-medium">Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.entries.map((e) => (
                        <tr
                          key={e.id}
                          className={e.isSkipped ? "text-ink-2 line-through" : "text-ink"}
                        >
                          <td className="py-1">{e.name}</td>
                          <td className="py-1 text-right text-ink-2">{fmt(Number(e.baseAmount))}</td>
                          <td className="py-1 text-right">{fmt(Number(e.plannedAmount))}</td>
                          <td className="py-1 text-right">
                            {e.actualAmount == null ? "—" : fmt(Number(e.actualAmount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
