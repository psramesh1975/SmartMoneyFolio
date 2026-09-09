import { Fragment } from "react";
import { MONTH_LABELS } from "@/lib/monthly-periods";
import type { MonthlySummary } from "@/lib/monthly-summary";
import type { MonthlyMonthPayload } from "@/lib/monthly-types";
import MonthlySheetTable, { type SheetRow } from "@/components/MonthlySheetTable";

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
            <div>
              {m.categories.map((c) => {
                const rows: SheetRow[] = c.entries.map((e) => ({
                  id: e.id,
                  name: e.name,
                  base: Number(e.baseAmount),
                  planned: Number(e.plannedAmount),
                  actual: e.actualAmount == null ? null : Number(e.actualAmount),
                  remark: e.notes,
                  isSkipped: e.isSkipped,
                }));
                return (
                  <MonthlySheetTable
                    key={c.id}
                    categoryName={c.name}
                    rows={rows}
                    enabledColumns={["planned", "actual"]}
                    showSkipColumn={false}
                    readOnly
                  />
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
