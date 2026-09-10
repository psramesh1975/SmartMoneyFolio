"use client";

import type { ReactNode } from "react";

export type SheetColumn = "base" | "planned" | "actual";

export type SheetRow = {
  id: string; // MonthlyEntry id, or MonthlyLineItem id on the Base page
  name: string;
  base: number | null;
  planned: number | null;
  actual: number | null;
  remark: string | null;
  isSkipped?: boolean; // month pages only
  // Extra controls shown next to the name (e.g. an "Edit" link for a
  // recurring line, or "Remove" for a one-off) — not part of the spec's
  // column set, so it rides along with the name cell instead of its own column.
  actions?: ReactNode;
};

export type MonthlySheetTableProps = {
  categoryName: string;
  rows: SheetRow[];
  enabledColumns: SheetColumn[]; // editable AND summed; other columns show but are inert
  showSkipColumn: boolean;
  onCellChange?: (rowId: string, field: SheetColumn | "remark" | "isSkipped", value: string | boolean) => void;
  footerSlot?: ReactNode;
  // Earlier Months / Earlier Years: plain text everywhere, no inputs, no footer slot.
  readOnly?: boolean;
};

const ALL_COLUMNS: SheetColumn[] = ["base", "planned", "actual"];
const COLUMN_LABELS: Record<SheetColumn, string> = {
  base: "Base",
  planned: "Planned",
  actual: "Actual",
};

function fmt(n: number | null) {
  if (n == null) return "";
  return Math.round(n).toLocaleString();
}

export default function MonthlySheetTable({
  categoryName,
  rows,
  enabledColumns,
  showSkipColumn,
  onCellChange,
  footerSlot,
  readOnly = false,
}: MonthlySheetTableProps) {
  function totalFor(col: SheetColumn): number | null {
    if (!enabledColumns.includes(col)) return null;
    return rows.reduce((sum, r) => {
      if (r.isSkipped) return sum;
      // Same rule as the summary bar above: an entry without an actual yet
      // counts as its planned amount, so the running total stays meaningful
      // mid-month instead of dropping to 0 for every unfilled line.
      const value = col === "actual" ? r.actual ?? r.planned ?? 0 : r[col] ?? 0;
      return sum + value;
    }, 0);
  }

  return (
    <div className="mt-6">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-sheet-header text-white font-semibold">
            <th className="border border-sheet-border px-2 py-1 text-left">{categoryName}</th>
            {ALL_COLUMNS.map((col) => (
              <th key={col} className="border border-sheet-border px-2 py-1 text-right">
                {COLUMN_LABELS[col]}
              </th>
            ))}
            <th className="border border-sheet-border px-2 py-1 text-left">Remark</th>
            {showSkipColumn && (
              <th className="border border-sheet-border px-2 py-1 text-center">Skip</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`bg-sheet-row ${row.isSkipped ? "line-through opacity-50" : ""}`}
            >
              <td className="border border-sheet-border px-2 py-1 text-slate-900">
                {row.name}
                {row.actions && <span className="ml-2">{row.actions}</span>}
              </td>
              {ALL_COLUMNS.map((col) => {
                const enabled = enabledColumns.includes(col);
                const value = row[col];
                if (readOnly) {
                  return (
                    <td key={col} className="border border-sheet-border px-2 py-1 text-right text-slate-900">
                      {value == null ? "-" : fmt(value)}
                    </td>
                  );
                }
                return (
                  <td
                    key={col}
                    className={`border border-sheet-border p-0 ${enabled ? "" : "bg-sheet-row/60"}`}
                  >
                    <input
                      // Keyed on the value so an external update (e.g. the Base
                      // page's "Edit" panel changing the same baseAmount this
                      // cell edits inline) forces a remount instead of leaving
                      // this uncontrolled input showing its stale initial value.
                      key={value ?? ""}
                      type="number"
                      defaultValue={value ?? ""}
                      disabled={!enabled || row.isSkipped}
                      onBlur={(e) => onCellChange?.(row.id, col, e.target.value)}
                      className="w-full border-0 bg-transparent px-2 py-1 text-right text-slate-900 focus:outline-none disabled:cursor-not-allowed"
                    />
                  </td>
                );
              })}
              <td className="border border-sheet-border p-0">
                {readOnly ? (
                  <div className="px-2 py-1 text-slate-900">{row.remark ?? ""}</div>
                ) : (
                  <input
                    key={row.remark ?? ""}
                    type="text"
                    defaultValue={row.remark ?? ""}
                    disabled={row.isSkipped}
                    onBlur={(e) => onCellChange?.(row.id, "remark", e.target.value)}
                    className="w-full border-0 bg-transparent px-2 py-1 text-slate-900 focus:outline-none disabled:cursor-not-allowed"
                  />
                )}
              </td>
              {showSkipColumn && (
                <td className="border border-sheet-border px-2 py-1 text-center">
                  {!readOnly && (
                    <input
                      key={String(row.isSkipped ?? false)}
                      type="checkbox"
                      defaultChecked={row.isSkipped ?? false}
                      onChange={(e) => onCellChange?.(row.id, "isSkipped", e.target.checked)}
                    />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-sheet-header text-white font-semibold">
            <td className="border border-sheet-border px-2 py-1">Total</td>
            {ALL_COLUMNS.map((col) => {
              const total = totalFor(col);
              return (
                <td key={col} className="border border-sheet-border px-2 py-1 text-right">
                  {total == null ? "-" : fmt(total)}
                </td>
              );
            })}
            <td className="border border-sheet-border px-2 py-1">-</td>
            {showSkipColumn && <td className="border border-sheet-border px-2 py-1" />}
          </tr>
        </tfoot>
      </table>
      {!readOnly && footerSlot && <div className="mt-2">{footerSlot}</div>}
    </div>
  );
}
