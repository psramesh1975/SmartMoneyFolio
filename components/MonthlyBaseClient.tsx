"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, ChevronRight, Landmark, TrendingUp } from "lucide-react";
import type {
  FlatBasePayload,
  MonthlyBaseAutoRowDTO,
  MonthlyCategoryOptionDTO,
} from "@/lib/monthly-types";
import { formatCurrency } from "@/lib/format-currency";
import { linkedBadgeTone } from "@/lib/monthly-badge";
import ManageCategoriesPanel from "@/components/ManageCategoriesPanel";

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function patchJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// "10th" / "1st" / "22nd" — for the Schedule column's "10th of Month".
function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

// General recurring expense row — the only kind of row a person creates or
// edits directly on this page. Debt (EMI) and SIP rows are auto-linked and
// read-only here; see lib/monthly-auto-sync.ts.
type Row = {
  id: string; // real MonthlyLineItem id once persisted, otherwise a local temp id
  name: string;
  baseAmount: string;
  categoryId: string;
  persisted: boolean;
};

function makeTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function MonthlyBaseClient({
  payload,
  baseCurrency,
}: {
  payload: FlatBasePayload;
  baseCurrency: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<MonthlyCategoryOptionDTO[]>(payload.categories);
  const [rows, setRows] = useState<Row[]>(
    payload.generalGroups.flatMap((g) => g.rows.map((r) => ({ ...r, persisted: true })))
  );
  const [showManageCategories, setShowManageCategories] = useState(false);
  // Every section defaults open — undefined reads as "not collapsed" so a
  // freshly-created category never needs its own state entry to start open.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isOpen = (key: string) => !collapsedSections[key];
  const toggleSection = (key: string) => setCollapsedSections((prev) => ({ ...prev, [key]: !isOpen(key) }));

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function rebindRef(oldId: string, newId: string) {
    nameInputRefs.current[newId] = nameInputRefs.current[oldId];
    delete nameInputRefs.current[oldId];
  }

  function handleAddRow(categoryId: string) {
    const tempId = makeTempId();
    setRows((prev) => [...prev, { id: tempId, name: "", baseAmount: "0.00", categoryId, persisted: false }]);
    requestAnimationFrame(() => nameInputRefs.current[tempId]?.focus());
  }

  // Not created server-side until the user actually types a name — a click
  // on "+ Add Line Item" alone never hits the API. The row already knows
  // its categoryId from the section it lives in, so no category picker here.
  async function createRow(row: Row, overrides: Partial<Pick<Row, "name" | "baseAmount">>) {
    const name = (overrides.name ?? row.name).trim();
    const baseAmount = overrides.baseAmount ?? row.baseAmount;
    if (!name) return;
    const { ok, data } = await postJSON("/api/monthly/line-items", {
      categoryId: row.categoryId,
      name,
      baseAmount: Number(baseAmount) || 0,
    });
    if (!ok) return;
    const newId = data.lineItem.id;
    rebindRef(row.id, newId);
    setRows((prev) => (prev.map((r) => (r.id === row.id ? { ...r, id: newId, name, baseAmount, persisted: true } : r))));
    router.refresh();
  }

  async function handleNameBlur(rowId: string, value: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const trimmed = value.trim();

    if (row.persisted) {
      if (trimmed && trimmed !== row.name) {
        const { ok } = await patchJSON(`/api/monthly/line-items/${rowId}`, { name: trimmed });
        if (ok) updateRow(rowId, { name: trimmed });
      }
      return;
    }

    if (!trimmed) return; // still blank — nothing to create yet
    await createRow(row, { name: trimmed });
  }

  function handleBaseChange(rowId: string, value: string) {
    updateRow(rowId, { baseAmount: value });
  }

  async function handleBaseBlur(rowId: string, value: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    if (row.persisted) {
      await patchJSON(`/api/monthly/line-items/${rowId}`, { baseAmount: Number(value) || 0 });
    } else if (row.name.trim()) {
      await createRow(row, { baseAmount: value });
    }
  }

  async function handleDelete(rowId: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    delete nameInputRefs.current[rowId];
    if (row.persisted) {
      // Soft-stop, not a hard delete — history already generated in past
      // months keeps its lineItemId.
      await patchJSON(`/api/monthly/line-items/${rowId}`, { isActive: false });
      router.refresh();
    }
  }

  // Shared by the Manage Categories panel's own "+ Add category" form — a
  // newly created category shows up here as an empty section immediately.
  function handleCategoryCreated(category: MonthlyCategoryOptionDTO) {
    setCategories((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category]));
    router.refresh();
  }

  function handleCategoryUpdated(category: MonthlyCategoryOptionDTO) {
    setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)));
    router.refresh();
  }

  function handleCategoryDeleted(categoryId: string) {
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    router.refresh();
  }

  const { kpis } = payload;
  const sipSubtotal = payload.sipRows.reduce((sum, r) => sum + (Number(r.baseAmount) || 0), 0);
  const debtSubtotal = payload.debtRows.reduce((sum, r) => sum + (Number(r.baseAmount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI row — border follows the household's chosen table theme */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--table-border)] bg-white p-5 shadow-sm dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Monthly Base Outflow
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {formatCurrency(kpis.totalOutflow, baseCurrency)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--table-border)] bg-white p-5 shadow-sm dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Wealth Building
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-blue-600 dark:text-lime-400">
            {formatCurrency(kpis.wealthBuilding, baseCurrency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {kpis.wealthBuildingPercent}% of total · Debt Servicing + SIPs
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--table-border)] bg-white p-5 shadow-sm dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Fixed Living &amp; Overhead
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            {formatCurrency(kpis.fixedLiving, baseCurrency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{kpis.fixedLivingPercent}% of total</p>
        </div>
      </div>

      {/* Header + Manage Categories — unchanged, sits above the table */}
      <div className="rounded-lg border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <h1 className="text-base font-bold text-slate-900 dark:text-white">Monthly Base</h1>
          <button
            type="button"
            onClick={() => setShowManageCategories((s) => !s)}
            className="focus-ring text-sm font-medium text-blue-600 underline decoration-dotted dark:text-lime-400"
          >
            {showManageCategories ? "Hide Categories" : "Manage Categories"}
          </button>
        </div>
        {showManageCategories && (
          <ManageCategoriesPanel
            categories={categories}
            onCategoryCreated={handleCategoryCreated}
            onCategoryUpdated={handleCategoryUpdated}
            onCategoryDeleted={handleCategoryDeleted}
          />
        )}
      </div>

      {/* One continuous table: section-divider rows separate Investments &
          SIPs, Debt & Loan Obligations, then each general category — same
          collapse/expand interaction as the old cards, restyled as table
          rows. Kept SIP/Debt as two separate dividers rather than merging
          them into one "Auto-Synced Commitments" row (per the mockup) so
          the existing sip-section-toggle/debt-section-toggle test ids and
          independent collapse state carry over unchanged. */}
      <div className="overflow-hidden rounded-lg border-2 border-[var(--table-border)] bg-white shadow-sm dark:bg-canvas-card">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr
              style={{ backgroundColor: "var(--table-header-bg)", color: "var(--table-header-text)" }}
              className="text-left text-xs font-bold uppercase tracking-wider"
            >
              <th className="w-[26%] px-4 py-3">Commitment/Expense</th>
              <th className="w-[18%] px-4 py-3">Category</th>
              <th className="w-[14%] px-4 py-3">Source/Sync</th>
              <th className="w-[14%] px-4 py-3">Schedule</th>
              <th className="w-[14%] px-4 py-3 text-right">Base</th>
              <th className="w-[14%] px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <SectionDividerRow
              icon={TrendingUp}
              title="Investments & SIPs"
              count={payload.sipRows.length}
              subtotal={sipSubtotal}
              baseCurrency={baseCurrency}
              isOpen={isOpen("sip")}
              onToggle={() => toggleSection("sip")}
              testId="sip-section-toggle"
            />
            {isOpen("sip") &&
              (payload.sipRows.length === 0 ? (
                <EmptyRow label="No active SIPs yet — set a monthly SIP amount on a Mutual Fund asset to see it here." />
              ) : (
                payload.sipRows.map((row) => (
                  <AutoTableRow key={row.id} row={row} baseCurrency={baseCurrency} prefix="sip-section" />
                ))
              ))}

            <SectionDividerRow
              icon={Landmark}
              title="Debt & Loan Obligations"
              count={payload.debtRows.length}
              subtotal={debtSubtotal}
              baseCurrency={baseCurrency}
              isOpen={isOpen("debt")}
              onToggle={() => toggleSection("debt")}
              testId="debt-section-toggle"
            />
            {isOpen("debt") &&
              (payload.debtRows.length === 0 ? (
                <EmptyRow label="No loan EMIs yet — set an EMI amount on a Liability to see it here." />
              ) : (
                payload.debtRows.map((row) => (
                  <AutoTableRow key={row.id} row={row} baseCurrency={baseCurrency} prefix="debt-section" />
                ))
              ))}

            {categories.map((c) => {
              const categoryRows = rows.filter((r) => r.categoryId === c.id);
              const subtotal = categoryRows.reduce((sum, r) => sum + (Number(r.baseAmount) || 0), 0);
              const open = isOpen(c.id);
              return (
                <Fragment key={c.id}>
                  <SectionDividerRow
                    key={`${c.id}-divider`}
                    title={c.name}
                    count={categoryRows.length}
                    subtotal={subtotal}
                    baseCurrency={baseCurrency}
                    isOpen={open}
                    onToggle={() => toggleSection(c.id)}
                  />
                  {open &&
                    (categoryRows.length === 0 ? (
                      <EmptyRow key={`${c.id}-empty`} label="No line items yet." />
                    ) : (
                      categoryRows.map((row) => (
                        <tr
                          key={row.id}
                          className="group border-t border-[var(--table-border)] hover:bg-[var(--table-hover-bg)]"
                        >
                          <td className="p-0">
                            <input
                              ref={(el) => {
                                nameInputRefs.current[row.id] = el;
                              }}
                              defaultValue={row.name}
                              placeholder="Expense description…"
                              onBlur={(e) => handleNameBlur(row.id, e.target.value)}
                              className="w-full border-0 bg-transparent px-4 py-2 text-slate-900 dark:text-white focus:outline-2 focus:outline-[var(--table-primary)]"
                            />
                          </td>
                          <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{c.name}</td>
                          <td className="px-4 py-2 text-slate-400 dark:text-slate-500">Manual Entry</td>
                          <td className="px-4 py-2 text-slate-400 dark:text-slate-500">—</td>
                          <td className="p-0">
                            <input
                              type="number"
                              step="any"
                              value={row.baseAmount}
                              onChange={(e) => handleBaseChange(row.id, e.target.value)}
                              onBlur={(e) => handleBaseBlur(row.id, e.target.value)}
                              className="w-full border-0 bg-transparent px-2 py-2 text-right font-mono text-slate-900 [font-variant-numeric:tabular-nums] focus:outline-2 focus:outline-[var(--table-primary)] dark:text-white"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => nameInputRefs.current[row.id]?.focus()}
                                aria-label="Edit"
                                className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row.id)}
                                aria-label="Delete"
                                className="text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ))}
                  {open && (
                    <tr key={`${c.id}-add`} className="border-t border-[var(--table-border)]">
                      <td colSpan={6} className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleAddRow(c.id)}
                          className="focus-ring text-sm font-medium text-blue-600 hover:underline dark:text-lime-400"
                        >
                          + Add Line Item
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr
              style={{ backgroundColor: "var(--table-footer-bg)", color: "var(--table-footer-text)" }}
              className="text-sm font-semibold"
            >
              <td className="px-4 py-3" colSpan={4}>
                Total Base Outflow
              </td>
              <td className="px-4 py-3 text-right font-mono [font-variant-numeric:tabular-nums]">
                {formatCurrency(kpis.totalOutflow, baseCurrency)}
              </td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Section-divider row — replaces the old AutoSection/card header buttons.
// Clicking it hides/shows the rows underneath, same interaction as before,
// just a table row instead of a card. `role="button"` + `aria-expanded` +
// keyboard activation make it behave like the <button> it replaces.
function SectionDividerRow({
  icon: Icon,
  title,
  count,
  subtotal,
  baseCurrency,
  isOpen,
  onToggle,
  testId,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  count: number;
  subtotal: number;
  baseCurrency: string;
  isOpen: boolean;
  onToggle: () => void;
  testId?: string;
}) {
  return (
    <tr
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      data-testid={testId}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className="cursor-pointer"
      style={{ backgroundColor: "var(--table-divider-bg)", color: "var(--table-divider-text)" }}
    >
      <td colSpan={6} className="px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            {Icon && <Icon size={14} className="shrink-0" />}
            {title}
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/10">
              {count}
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold [font-variant-numeric:tabular-nums]">
              {formatCurrency(subtotal, baseCurrency)}
            </span>
            <ChevronRight size={14} className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </span>
        </div>
      </td>
    </tr>
  );
}

// Read-only row for an auto-linked Debt/SIP line — no edit/delete controls,
// these are sourced from Liabilities/Assets and can only be changed there.
// `prefix` reproduces the old AutoSection's data-testid contract exactly
// ("sip-section"/"debt-section") so the existing Playwright suite keeps
// matching sip-section-row-<id> / sip-section-row-badge-<id> unchanged.
function AutoTableRow({
  row,
  baseCurrency,
  prefix,
}: {
  row: MonthlyBaseAutoRowDTO;
  baseCurrency: string;
  prefix: "sip-section" | "debt-section";
}) {
  const isSip = row.kind === "SIP";
  const sourceHref = isSip ? "/assets" : "/liabilities";
  const sourceLabel = isSip ? "Assets ↗" : "Liabilities ↗";

  return (
    <tr
      data-testid={`${prefix}-row-${row.id}`}
      className="border-t border-[var(--table-border)] hover:bg-[var(--table-hover-bg)]"
    >
      <td className="px-4 py-2 text-slate-900 dark:text-white">
        {row.name}
        {row.subtitle && <span className="block text-xs text-slate-400 dark:text-slate-500">{row.subtitle}</span>}
      </td>
      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
        {isSip ? "Investments & SIPs" : "Debt & Loan Obligations"}
      </td>
      <td className="px-4 py-2">
        {row.sourceId ? (
          <Link href={sourceHref} className="text-blue-600 hover:underline dark:text-lime-400">
            {sourceLabel}
          </Link>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
        {row.dueDay ? `${ordinal(row.dueDay)} of Month` : "—"}
      </td>
      <td className="px-4 py-2 text-right font-mono text-slate-900 [font-variant-numeric:tabular-nums] dark:text-white">
        {formatCurrency(row.baseAmount, baseCurrency)}
      </td>
      <td className="px-4 py-2">
        <span
          data-testid={`${prefix}-row-badge-${row.id}`}
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${linkedBadgeTone(row.kind)}`}
        >
          {isSip ? "Active SIP" : "EMI"}
        </span>
        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">Synced</span>
      </td>
    </tr>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <tr className="border-t border-[var(--table-border)]">
      <td colSpan={6} className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        {label}
      </td>
    </tr>
  );
}
