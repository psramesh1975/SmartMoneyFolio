"use client";

import type { ReactNode } from "react";

// One continuous table for a month page (Previous/Current/Next) — same
// visual structure as MonthlyBaseClient's table (Expense | Category | Base),
// with Planned/Actual/Remark/Skip added. Replaces the old per-category
// MonthlySheetTable grouping: every entry across every category is a single
// row here, already in category-sortOrder-then-createdAt order by the time
// it reaches this component (the caller flattens MonthlyCategoryDTO[] in
// that order — nothing is re-sorted in here).

export type FlatRow = {
  id: string; // MonthlyEntry id
  name: string;
  categoryName: string;
  base: number; // reference snapshot, never editable here
  planned: number;
  actual: number | null;
  remark: string | null;
  isSkipped: boolean;
  // "Remove" for a one-off row (lineItemId == null) — rides along with the
  // name cell, same as the old per-category table did.
  actions?: ReactNode;
};

export type MonthlyFlatTableField = "planned" | "actual" | "remark" | "isSkipped";

function fmt(n: number | null) {
  if (n == null) return "";
  return Math.round(n).toLocaleString();
}

export default function MonthlyFlatTable({
  rows,
  onCellChange,
}: {
  rows: FlatRow[];
  onCellChange: (rowId: string, field: MonthlyFlatTableField, value: string | boolean) => void;
}) {
  const plannedTotal = rows.reduce((sum, r) => (r.isSkipped ? sum : sum + r.planned), 0);
  // Same rule as the summary bar: an entry without an actual yet counts as
  // its planned amount, so the running total stays meaningful mid-month.
  const actualTotal = rows.reduce(
    (sum, r) => (r.isSkipped ? sum : sum + (r.actual ?? r.planned)),
    0
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-sheet-header text-white font-semibold">
            <th className="w-[22%] border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-left">Expense</th>
            <th className="w-[16%] border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-left">Category</th>
            <th className="w-[12%] border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-right">Base</th>
            <th className="w-[12%] border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-right">Planned</th>
            <th className="w-[12%] border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-right">Actual</th>
            <th className="w-[18%] border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-left">Remark</th>
            <th className="w-[8%] border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-center">Skip</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`bg-sheet-row dark:bg-sheet-row-dark ${row.isSkipped ? "line-through opacity-50" : ""}`}
            >
              <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-slate-900 dark:text-white">
                {row.name}
                {row.actions && <span className="ml-2">{row.actions}</span>}
              </td>
              <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-slate-500 dark:text-slate-300">
                {row.categoryName}
              </td>
              <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-right text-slate-500 dark:text-slate-300">
                {fmt(row.base)}
              </td>
              <td className="border border-sheet-border dark:border-sheet-border-dark p-0">
                <input
                  key={row.planned}
                  type="number"
                  defaultValue={row.planned}
                  disabled={row.isSkipped}
                  onBlur={(e) => onCellChange(row.id, "planned", e.target.value)}
                  className="w-full border-0 bg-transparent px-3 py-2 text-right text-slate-900 dark:text-white focus:outline-none disabled:cursor-not-allowed"
                />
              </td>
              <td className="border border-sheet-border dark:border-sheet-border-dark p-0">
                <input
                  key={row.actual ?? ""}
                  type="number"
                  defaultValue={row.actual ?? ""}
                  disabled={row.isSkipped}
                  onBlur={(e) => onCellChange(row.id, "actual", e.target.value)}
                  className="w-full border-0 bg-transparent px-3 py-2 text-right text-slate-900 dark:text-white focus:outline-none disabled:cursor-not-allowed"
                />
              </td>
              <td className="border border-sheet-border dark:border-sheet-border-dark p-0">
                <input
                  key={row.remark ?? ""}
                  type="text"
                  defaultValue={row.remark ?? ""}
                  disabled={row.isSkipped}
                  onBlur={(e) => onCellChange(row.id, "remark", e.target.value)}
                  className="w-full border-0 bg-transparent px-3 py-2 text-slate-900 dark:text-white focus:outline-none disabled:cursor-not-allowed"
                />
              </td>
              <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-center">
                <input
                  key={String(row.isSkipped)}
                  type="checkbox"
                  defaultChecked={row.isSkipped}
                  onChange={(e) => onCellChange(row.id, "isSkipped", e.target.checked)}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-sheet-header text-white font-semibold">
            <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2">Total</td>
            <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2" />
            <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-right">-</td>
            <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-right">{fmt(plannedTotal)}</td>
            <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2 text-right">{fmt(actualTotal)}</td>
            <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2">-</td>
            <td className="border border-sheet-border dark:border-sheet-border-dark px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
