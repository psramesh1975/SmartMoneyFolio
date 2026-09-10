"use client";

import { useState } from "react";
import { MONTH_LABELS } from "@/lib/monthly-periods";
import MonthlySheetTable, { type SheetRow } from "@/components/MonthlySheetTable";
import type { MonthlyMonthPayload } from "@/lib/monthly-types";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

// One expandable card, collapsed by default. Collapsed shows just the
// headline totals (actual figures — falling back to planned for any line
// not yet filled in, same as everywhere else); expanding reveals the full
// read-only Base/Planned/Actual breakdown per category.
export default function MonthHistoryCard({
  payload,
  currency,
}: {
  payload: MonthlyMonthPayload;
  currency: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { summary } = payload;
  const netSaved = summary.netSurplusActual;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="focus-ring flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5"
      >
        <span className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          <span className="text-slate-500 dark:text-slate-400">{expanded ? "▾" : "▸"}</span>
          {MONTH_LABELS[payload.month - 1]} {payload.year}
        </span>
        <span className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          <span>
            Total Inflow: {currency} {fmt(summary.actualIncome)}
          </span>
          <span>
            Total Outflow: {currency} {fmt(summary.actualOutflow)}
          </span>
          <span className={netSaved >= 0 ? "font-semibold text-emerald-600 dark:text-cyan-400" : "font-semibold text-rose-600 dark:text-rose-400"}>
            Net Saved: {currency} {fmt(netSaved)}
          </span>
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-200/80 p-4 dark:border-slate-800">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            * Actual totals count any line without an entered actual as its planned amount.
          </p>
          {payload.categories.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No entries.</p>
          ) : (
            payload.categories.map((c) => {
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
            })
          )}
        </div>
      )}
    </div>
  );
}
