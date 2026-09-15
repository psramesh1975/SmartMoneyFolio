"use client";

import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/format-currency";

// Two separate card-tables — one for Income/Inflow entries, one for every
// Outflow entry (debt EMIs, SIPs, living expenses, subscriptions — whichever
// categories exist) — instead of one flat table mixing both. Matches the
// "Single Unified Outflows Ledger" reference mockup's split: inflow rows and
// outflow rows are never rendered in the same table or summed into the same
// total, so a line like "Salary" can never look like — or get added into —
// an expense figure. Visual language (colored-dot header, translucent pill,
// header-only subtotal) matches MonthlyBaseClient's card-tables so Monthly
// Base and the month-tracking pages (Previous/Current/Next) read as one
// consistent system.

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

// Deterministic name → tone mapping, same approach as MonthlyBaseClient's
// categoryChipTone, so a given category reads in the same color wherever it
// shows up across the app.
const CHIP_PALETTE = [
  "border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
  "border-blue-200/70 bg-blue-50 text-blue-800 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300",
  "border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
  "border-indigo-200/70 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-300",
  "border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300",
  "border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
];
function categoryChipTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CHIP_PALETTE[hash % CHIP_PALETTE.length];
}

function CardHeaderRow({
  dotClassName,
  title,
  pillLabel,
  subtotalLabel,
  subtotal,
  currency,
}: {
  dotClassName: string;
  title: string;
  pillLabel: string;
  subtotalLabel: string;
  subtotal: number;
  currency: string;
}) {
  return (
    <tr style={{ backgroundColor: "var(--table-header-bg)", color: "var(--table-header-text)" }}>
      <th colSpan={7} className="px-4 py-3 text-left font-normal sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClassName}`} />
            <span className="text-xs font-extrabold uppercase tracking-wide sm:text-sm">{title}</span>
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: "color-mix(in srgb, currentColor 18%, transparent)" }}
            >
              {pillLabel}
            </span>
          </div>
          <div className="font-mono text-xs [font-variant-numeric:tabular-nums]">
            {subtotalLabel}: <strong className="text-sm font-bold">{formatCurrency(subtotal, currency)}</strong>
          </div>
        </div>
      </th>
    </tr>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <tr className="border-t" style={{ borderColor: "var(--table-border)" }}>
      <td colSpan={7} className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">
        {label}
      </td>
    </tr>
  );
}

export default function MonthlyFlatTableCard({
  title,
  pillLabel,
  dotClassName,
  itemColumnLabel,
  namePlaceholderIsIncome,
  hasCategories,
  noCategoryLabel,
  rows,
  currency,
  onCellChange,
  oneOffSlot,
}: {
  title: string;
  pillLabel: string;
  dotClassName: string;
  itemColumnLabel: string;
  namePlaceholderIsIncome: boolean;
  hasCategories: boolean;
  noCategoryLabel: string;
  rows: FlatRow[];
  currency: string;
  onCellChange: (rowId: string, field: MonthlyFlatTableField, value: string | boolean) => void;
  oneOffSlot?: ReactNode;
}) {
  const plannedTotal = rows.reduce((sum, r) => (r.isSkipped ? sum : sum + r.planned), 0);
  // Same rule as the summary bar: an entry without an actual yet counts as
  // its planned amount, so the running total stays meaningful mid-month.
  const actualTotal = rows.reduce((sum, r) => (r.isSkipped ? sum : sum + (r.actual ?? r.planned)), 0);

  return (
    <div
      className="overflow-hidden rounded-2xl border-2 bg-white shadow-sm dark:bg-canvas-card"
      style={{ borderColor: "var(--table-border)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <thead>
            <CardHeaderRow
              dotClassName={dotClassName}
              title={title}
              pillLabel={pillLabel}
              subtotalLabel="Actual"
              subtotal={actualTotal}
              currency={currency}
            />
            <tr className="border-b bg-slate-100 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-white/5 dark:text-slate-300">
              <th className="w-[22%] py-3 px-5">{itemColumnLabel}</th>
              <th className="w-[16%] py-3 px-4">Category</th>
              <th className="w-[11%] py-3 px-4 text-right">Base</th>
              <th className="w-[13%] py-3 px-4 text-right">Planned</th>
              <th className="w-[13%] py-3 px-4 text-right">Actual</th>
              <th className="w-[17%] py-3 px-4">Remark</th>
              <th className="w-[7%] py-3 px-5 text-center">Skip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800">
            {!hasCategories ? (
              <EmptyRow label={noCategoryLabel} />
            ) : rows.length === 0 ? (
              <EmptyRow
                label={
                  namePlaceholderIsIncome
                    ? "No income entries this month yet."
                    : "No outflow entries this month yet."
                }
              />
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`transition hover:bg-slate-50/70 dark:hover:bg-white/5 ${
                    row.isSkipped ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <span className={row.isSkipped ? "line-through" : ""}>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">{row.name}</span>
                      {row.actions && <span className="ml-2">{row.actions}</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block rounded-md border px-2.5 py-1 text-[11px] font-bold ${categoryChipTone(
                        row.categoryName
                      )}`}
                    >
                      {row.categoryName}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-500 dark:text-slate-400">
                    {formatCurrency(row.base, currency)}
                  </td>
                  <td className="p-0">
                    <input
                      key={row.planned}
                      type="number"
                      defaultValue={row.planned}
                      disabled={row.isSkipped}
                      onBlur={(e) => onCellChange(row.id, "planned", e.target.value)}
                      className="w-full border-0 bg-transparent px-4 py-3.5 text-right font-mono text-sm font-bold text-slate-950 [font-variant-numeric:tabular-nums] focus:outline-2 focus:outline-[var(--table-primary)] disabled:cursor-not-allowed dark:text-white"
                    />
                  </td>
                  <td className="p-0">
                    <input
                      key={row.actual ?? ""}
                      type="number"
                      defaultValue={row.actual ?? ""}
                      disabled={row.isSkipped}
                      onBlur={(e) => onCellChange(row.id, "actual", e.target.value)}
                      className="w-full border-0 bg-transparent px-4 py-3.5 text-right font-mono text-sm font-bold text-slate-950 [font-variant-numeric:tabular-nums] focus:outline-2 focus:outline-[var(--table-primary)] disabled:cursor-not-allowed dark:text-white"
                    />
                  </td>
                  <td className="p-0">
                    <input
                      key={row.remark ?? ""}
                      type="text"
                      defaultValue={row.remark ?? ""}
                      disabled={row.isSkipped}
                      placeholder="—"
                      onBlur={(e) => onCellChange(row.id, "remark", e.target.value)}
                      className="w-full border-0 bg-transparent px-4 py-3.5 text-slate-600 focus:outline-2 focus:outline-[var(--table-primary)] disabled:cursor-not-allowed dark:text-slate-400"
                    />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <input
                      key={String(row.isSkipped)}
                      type="checkbox"
                      defaultChecked={row.isSkipped}
                      onChange={(e) => onCellChange(row.id, "isSkipped", e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasCategories && oneOffSlot && (
        <div className="flex justify-center border-t border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-white/5">
          {oneOffSlot}
        </div>
      )}
    </div>
  );
}
