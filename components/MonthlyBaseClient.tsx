"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  // its categoryId from the card it lives in, so no category picker here.
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
  // newly created category shows up here as an empty card immediately.
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

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Monthly Base Outflow
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {formatCurrency(kpis.totalOutflow, baseCurrency)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
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
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Fixed Living &amp; Overhead
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            {formatCurrency(kpis.fixedLiving, baseCurrency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{kpis.fixedLivingPercent}% of total</p>
        </div>
      </div>

      {/* Header + Manage Categories */}
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

      {/* Auto-linked, read-only sections */}
      <AutoSection
        title="Investments & SIPs"
        icon={TrendingUp}
        rows={payload.sipRows}
        baseCurrency={baseCurrency}
        isOpen={isOpen("sip")}
        onToggle={() => toggleSection("sip")}
        emptyLabel="No active SIPs yet — set a monthly SIP amount on a Mutual Fund asset to see it here."
        testId="sip-section"
      />
      <AutoSection
        title="Debt & Loan Obligations"
        icon={Landmark}
        rows={payload.debtRows}
        baseCurrency={baseCurrency}
        isOpen={isOpen("debt")}
        onToggle={() => toggleSection("debt")}
        emptyLabel="No loan EMIs yet — set an EMI amount on a Liability to see it here."
        testId="debt-section"
      />

      {/* General Recurring Expenses */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">General Recurring Expenses</h2>
        {categories.map((c) => {
          const categoryRows = rows.filter((r) => r.categoryId === c.id);
          const subtotal = categoryRows.reduce((sum, r) => sum + (Number(r.baseAmount) || 0), 0);
          const open = isOpen(c.id);
          return (
            <div
              key={c.id}
              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card"
            >
              <button
                type="button"
                onClick={() => toggleSection(c.id)}
                className="focus-ring flex w-full items-center justify-between px-4 py-3 text-left"
                aria-expanded={open}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{c.name}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400">
                    {categoryRows.length}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">
                    {formatCurrency(subtotal, baseCurrency)}
                  </span>
                  <ChevronRight
                    size={16}
                    className={`text-slate-400 transition-transform dark:text-slate-500 ${open ? "rotate-90" : ""}`}
                  />
                </span>
              </button>

              {open && (
                <div className="border-t border-slate-200/80 dark:border-slate-800">
                  {categoryRows.length > 0 && (
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-500 dark:bg-white/5 dark:text-slate-400">
                          <th className="w-[70%] px-4 py-2 font-medium">Name</th>
                          <th className="px-2 py-2 text-right font-medium">Amount</th>
                          <th className="w-16 px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {categoryRows.map((row) => (
                          <tr key={row.id} className="group border-t border-slate-100 dark:border-slate-800/60">
                            <td className="p-0">
                              <input
                                ref={(el) => {
                                  nameInputRefs.current[row.id] = el;
                                }}
                                defaultValue={row.name}
                                placeholder="Expense description…"
                                onBlur={(e) => handleNameBlur(row.id, e.target.value)}
                                className="w-full border-0 bg-transparent px-4 py-2 text-slate-900 dark:text-white focus:bg-slate-50 dark:focus:bg-white/5 focus:outline-none"
                              />
                            </td>
                            <td className="p-0">
                              <input
                                type="number"
                                step="any"
                                value={row.baseAmount}
                                onChange={(e) => handleBaseChange(row.id, e.target.value)}
                                onBlur={(e) => handleBaseBlur(row.id, e.target.value)}
                                className="w-full border-0 bg-transparent px-2 py-2 text-right text-slate-900 dark:text-white [font-variant-numeric:tabular-nums] focus:bg-slate-50 dark:focus:bg-white/5 focus:outline-none"
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
                        ))}
                      </tbody>
                    </table>
                  )}
                  {categoryRows.length === 0 && (
                    <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No line items yet.</p>
                  )}
                  <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => handleAddRow(c.id)}
                      className="focus-ring text-sm font-medium text-blue-600 hover:underline dark:text-lime-400"
                    >
                      + Add Line Item
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Read-only collapsible section for the auto-linked Debt/SIP rows — no
// edit/delete controls, these are sourced from Liabilities/Assets and can
// only be changed there.
function AutoSection({
  title,
  icon: Icon,
  rows,
  baseCurrency,
  isOpen,
  onToggle,
  emptyLabel,
  testId,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  rows: MonthlyBaseAutoRowDTO[];
  baseCurrency: string;
  isOpen: boolean;
  onToggle: () => void;
  emptyLabel: string;
  testId: string;
}) {
  const subtotal = rows.reduce((sum, r) => sum + (Number(r.baseAmount) || 0), 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card">
      <button
        type="button"
        onClick={onToggle}
        className="focus-ring flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={isOpen}
        data-testid={`${testId}-toggle`}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 dark:border-lime-400/20 dark:bg-lime-400/10 dark:text-lime-400">
            <Icon size={16} />
          </span>
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400">
              {rows.length}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">
            {formatCurrency(subtotal, baseCurrency)}
          </span>
          <ChevronRight
            size={16}
            className={`text-slate-400 transition-transform dark:text-slate-500 ${isOpen ? "rotate-90" : ""}`}
          />
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-200/80 dark:border-slate-800">
          {rows.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                data-testid={`${testId}-row-${row.id}`}
                className="flex items-center justify-between border-t border-slate-100 px-4 py-3 first:border-t-0 dark:border-slate-800/60"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{row.name}</p>
                  {row.subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{row.subtitle}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    data-testid={`${testId}-row-badge-${row.id}`}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${linkedBadgeTone(row.kind)}`}
                  >
                    {row.kind === "SIP" ? "Active SIP" : "EMI"}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white [font-variant-numeric:tabular-nums]">
                    {formatCurrency(row.baseAmount, baseCurrency)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
