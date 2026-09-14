"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Landmark, TrendingUp, Wallet, Receipt, AlertTriangle } from "lucide-react";
import type {
  FlatBasePayload,
  MonthlyBaseAutoRowDTO,
  MonthlyCategoryOptionDTO,
} from "@/lib/monthly-types";
import { formatCurrency } from "@/lib/format-currency";
import { categoryBadgeTone, linkedBadgeTone } from "@/lib/monthly-badge";
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

type RowKind = "income" | "expense";

// A manual recurring row — Income and Expense share this shape, and which
// card a row renders in is derived (not stored) from whether its categoryId
// currently points at an INCOME or OUTFLOW category. Debt (EMI) and SIP rows
// are a different, auto-linked, read-only shape — see MonthlyBaseAutoRowDTO.
type Row = {
  id: string; // real MonthlyLineItem id once persisted, otherwise a local temp id
  name: string;
  baseAmount: string;
  categoryId: string;
  scheduleDay: number | null;
  paymentMethod: string | null;
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
  const [rows, setRows] = useState<Row[]>([
    ...payload.incomeRows.map((r) => ({ ...r, persisted: true })),
    ...payload.expenseRows.map((r) => ({ ...r, persisted: true })),
  ]);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Derived from `categories` (not `payload`) so renaming a category's type
  // via Manage Categories immediately moves its rows to the other card.
  const incomeCategories = categories.filter((c) => c.type === "INCOME");
  const expenseCategories = categories.filter((c) => c.type === "OUTFLOW");
  const incomeCategoryIds = new Set(incomeCategories.map((c) => c.id));
  const incomeRows = rows.filter((r) => incomeCategoryIds.has(r.categoryId));
  const expenseRows = rows.filter((r) => !incomeCategoryIds.has(r.categoryId));

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function rebindRef(oldId: string, newId: string) {
    nameInputRefs.current[newId] = nameInputRefs.current[oldId];
    delete nameInputRefs.current[oldId];
  }

  function handleAddRow(kind: RowKind) {
    const list = kind === "income" ? incomeCategories : expenseCategories;
    if (list.length === 0) return; // "+ Add Row" is hidden in that case — see ManualCardTable
    const tempId = makeTempId();
    setRows((prev) => [
      ...prev,
      {
        id: tempId,
        name: "",
        baseAmount: "0.00",
        categoryId: list[0].id,
        scheduleDay: null,
        paymentMethod: null,
        persisted: false,
      },
    ]);
    requestAnimationFrame(() => nameInputRefs.current[tempId]?.focus());
  }

  // Not created server-side until the user actually types a name — a click
  // on "+ Add Row" alone never hits the API. `overrides` lets a blur on any
  // of the four editable fields be the one that finally creates the row,
  // carrying whatever value it just captured plus whatever else the row
  // already had (e.g. a schedule day set before the name was typed).
  async function createRow(
    row: Row,
    overrides: Partial<Pick<Row, "name" | "baseAmount" | "scheduleDay" | "paymentMethod">>
  ) {
    const name = (overrides.name ?? row.name).trim();
    const baseAmount = overrides.baseAmount ?? row.baseAmount;
    const scheduleDay = overrides.scheduleDay !== undefined ? overrides.scheduleDay : row.scheduleDay;
    const paymentMethod = overrides.paymentMethod !== undefined ? overrides.paymentMethod : row.paymentMethod;
    if (!name) return;
    const { ok, data } = await postJSON("/api/monthly/line-items", {
      categoryId: row.categoryId,
      name,
      baseAmount: Number(baseAmount) || 0,
      scheduleDay,
      paymentMethod,
    });
    if (!ok) return;
    const newId = data.lineItem.id;
    rebindRef(row.id, newId);
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, id: newId, name, baseAmount, scheduleDay, paymentMethod, persisted: true } : r
      )
    );
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

  // Only meaningful before a row is first saved — a category select renders
  // in place of the badge for unpersisted rows with more than one option.
  // Once persisted, the category is fixed (a badge, not a control).
  function handleCategoryChange(rowId: string, categoryId: string) {
    updateRow(rowId, { categoryId });
  }

  async function handleScheduleDayBlur(rowId: string, rawValue: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const trimmed = rawValue.trim();
    let next: number | null = null;
    if (trimmed !== "") {
      const n = Math.round(Number(trimmed));
      if (Number.isFinite(n)) next = Math.min(31, Math.max(1, n));
    }

    if (row.persisted) {
      if (next !== row.scheduleDay) {
        const { ok } = await patchJSON(`/api/monthly/line-items/${rowId}`, { scheduleDay: next });
        if (ok) updateRow(rowId, { scheduleDay: next });
      }
      return;
    }

    if (!row.name.trim()) return;
    await createRow(row, { scheduleDay: next });
  }

  async function handlePaymentMethodBlur(rowId: string, value: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const trimmed = value.trim();
    const next = trimmed === "" ? null : trimmed;

    if (row.persisted) {
      if (next !== row.paymentMethod) {
        const { ok } = await patchJSON(`/api/monthly/line-items/${rowId}`, { paymentMethod: next });
        if (ok) updateRow(rowId, { paymentMethod: next });
      }
      return;
    }

    if (!row.name.trim()) return;
    await createRow(row, { paymentMethod: next });
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
  // newly created category shows up here immediately (as an empty Income or
  // Expense card, or as a new option on an unsaved row's category picker).
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
  // Flagged by percent (matches the KPI's own definition of "in the red"),
  // not just by the buffer amount being negative, so the two never disagree.
  const netNegative = kpis.netBufferPercent < 0;

  return (
    <div className="space-y-6">
      {/* Headline KPI row — Income / Outflow / Net Buffer, per the mockup.
          Border follows the household's chosen table theme. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--table-border)] bg-white p-5 shadow-sm dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Expected Monthly Income
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {formatCurrency(kpis.totalIncome, baseCurrency)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--table-border)] bg-white p-5 shadow-sm dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Base Outflow
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {formatCurrency(kpis.totalOutflow, baseCurrency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Debt Servicing &amp; SIPs {formatCurrency(kpis.wealthBuilding, baseCurrency)} · Fixed Living{" "}
            {formatCurrency(kpis.fixedLiving, baseCurrency)}
          </p>
        </div>
        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            netNegative
              ? "border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10"
              : "border-[var(--table-border)] bg-white dark:bg-canvas-card"
          }`}
        >
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {netNegative && <AlertTriangle size={13} className="text-rose-600 dark:text-rose-400" />}
            Net Monthly Buffer
          </span>
          <p
            className={`mt-1 text-2xl font-black tracking-tight ${
              netNegative ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-lime-400"
            }`}
          >
            {formatCurrency(kpis.netBuffer, baseCurrency)}
          </p>
          <p
            className={`mt-1 text-xs font-medium ${
              netNegative ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {kpis.netBufferPercent}% {netNegative ? "Over Income" : "Saved"}
          </p>
        </div>
      </div>

      {/* Secondary stats — Wealth Building / Fixed Living, still available
          just no longer the headline three (Income/Outflow/Buffer are). */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--table-border)] bg-white px-4 py-3 shadow-sm dark:bg-canvas-card">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Wealth Building
          </span>
          <p className="mt-0.5 text-lg font-bold tracking-tight text-blue-600 dark:text-lime-400">
            {formatCurrency(kpis.wealthBuilding, baseCurrency)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {kpis.wealthBuildingPercent}% of outflow · Debt Servicing + SIPs
          </p>
        </div>
        <div className="rounded-xl border border-[var(--table-border)] bg-white px-4 py-3 shadow-sm dark:bg-canvas-card">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Fixed Living &amp; Overhead
          </span>
          <p className="mt-0.5 text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {formatCurrency(kpis.fixedLiving, baseCurrency)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{kpis.fixedLivingPercent}% of outflow</p>
        </div>
      </div>

      {/* Header + Manage Categories — unchanged, sits above the four cards */}
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

      {/* Four bordered card-tables, stacked, in the mockup's order: Income,
          Debt (EMIs), Investments & SIPs, Expenses. Each keeps the
          household's --table-* theme instead of the mockup's hardcoded
          slate-950 header bar. */}
      <ManualCardTable
        kind="income"
        rows={incomeRows}
        categories={incomeCategories}
        baseCurrency={baseCurrency}
        nameInputRefs={nameInputRefs}
        onAddRow={() => handleAddRow("income")}
        onNameBlur={handleNameBlur}
        onBaseChange={handleBaseChange}
        onBaseBlur={handleBaseBlur}
        onScheduleDayBlur={handleScheduleDayBlur}
        onPaymentMethodBlur={handlePaymentMethodBlur}
        onCategoryChange={handleCategoryChange}
        onDelete={handleDelete}
      />

      <AutoCardTable
        icon={Landmark}
        title="Liabilities & Debt Servicing (EMIs)"
        rows={payload.debtRows}
        baseCurrency={baseCurrency}
        emptyLabel="No loan EMIs yet — set an EMI amount on a Liability to see it here."
        footerLabel="Total Debt Servicing"
        prefix="debt-section"
      />

      <AutoCardTable
        icon={TrendingUp}
        title="Investments & SIPs"
        rows={payload.sipRows}
        baseCurrency={baseCurrency}
        emptyLabel="No active SIPs yet — set a monthly SIP amount on a Mutual Fund asset to see it here."
        footerLabel="Total SIP Contributions"
        prefix="sip-section"
      />

      <ManualCardTable
        kind="expense"
        rows={expenseRows}
        categories={expenseCategories}
        baseCurrency={baseCurrency}
        nameInputRefs={nameInputRefs}
        onAddRow={() => handleAddRow("expense")}
        onNameBlur={handleNameBlur}
        onBaseChange={handleBaseChange}
        onBaseBlur={handleBaseBlur}
        onScheduleDayBlur={handleScheduleDayBlur}
        onPaymentMethodBlur={handlePaymentMethodBlur}
        onCategoryChange={handleCategoryChange}
        onDelete={handleDelete}
      />
    </div>
  );
}

// Card header shared by all four tables: icon + title + row count on the
// left, running subtotal on the right — replaces the mockup's bg-slate-950
// bar with the household's --table-header-bg/--table-header-text theme.
function CardHeaderRow({
  icon: Icon,
  title,
  count,
  subtotal,
  baseCurrency,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  count: number;
  subtotal: number;
  baseCurrency: string;
}) {
  return (
    <tr style={{ backgroundColor: "var(--table-header-bg)", color: "var(--table-header-text)" }}>
      <th colSpan={6} className="px-4 py-3 text-left font-normal">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <Icon size={14} className="shrink-0" />
            {title}
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-medium dark:bg-white/10">
              {count}
            </span>
          </span>
          <span className="font-mono text-xs font-bold [font-variant-numeric:tabular-nums]">
            {formatCurrency(subtotal, baseCurrency)}
          </span>
        </div>
      </th>
    </tr>
  );
}

function CardFooterRow({ label, subtotal, baseCurrency }: { label: string; subtotal: number; baseCurrency: string }) {
  return (
    <tr style={{ backgroundColor: "var(--table-footer-bg)", color: "var(--table-footer-text)" }} className="text-sm font-semibold">
      <td className="px-4 py-3" colSpan={4}>
        {label}
      </td>
      <td className="px-4 py-3 text-right font-mono [font-variant-numeric:tabular-nums]">
        {formatCurrency(subtotal, baseCurrency)}
      </td>
      <td className="px-4 py-3" />
    </tr>
  );
}

// Manual, editable card — used for both Income and Expense. Which card a
// row belongs to, its labels, and its placeholder text all key off `kind`;
// everything else (inline edit, add-row, delete) is identical.
function ManualCardTable({
  kind,
  rows,
  categories,
  baseCurrency,
  nameInputRefs,
  onAddRow,
  onNameBlur,
  onBaseChange,
  onBaseBlur,
  onScheduleDayBlur,
  onPaymentMethodBlur,
  onCategoryChange,
  onDelete,
}: {
  kind: RowKind;
  rows: Row[];
  categories: MonthlyCategoryOptionDTO[];
  baseCurrency: string;
  nameInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onAddRow: () => void;
  onNameBlur: (id: string, value: string) => void;
  onBaseChange: (id: string, value: string) => void;
  onBaseBlur: (id: string, value: string) => void;
  onScheduleDayBlur: (id: string, value: string) => void;
  onPaymentMethodBlur: (id: string, value: string) => void;
  onCategoryChange: (id: string, categoryId: string) => void;
  onDelete: (id: string) => void;
}) {
  const isIncome = kind === "income";
  const Icon = isIncome ? Wallet : Receipt;
  const title = isIncome ? "Recurring Income & Inflows" : "Monthly Base Expenses & Overhead";
  const itemColumnLabel = isIncome ? "Inflow Source" : "Expense/Item";
  const scheduleColumnLabel = isIncome ? "Credit Day" : "Schedule";
  const methodColumnLabel = isIncome ? "Account/Mode" : "Payment Method";
  const namePlaceholder = isIncome ? "Salary, rental income…" : "Expense description…";
  const subtotal = rows.reduce((sum, r) => sum + (Number(r.baseAmount) || 0), 0);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="overflow-hidden rounded-lg border-2 border-[var(--table-border)] bg-white shadow-sm dark:bg-canvas-card">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <CardHeaderRow icon={Icon} title={title} count={rows.length} subtotal={subtotal} baseCurrency={baseCurrency} />
          <tr
            style={{ backgroundColor: "var(--table-header-bg)", color: "var(--table-header-text)" }}
            className="text-left text-xs font-bold uppercase tracking-wider"
          >
            <th className="w-[26%] px-4 py-2">{itemColumnLabel}</th>
            <th className="w-[18%] px-4 py-2">Category</th>
            <th className="w-[14%] px-4 py-2">{scheduleColumnLabel}</th>
            <th className="w-[14%] px-4 py-2">{methodColumnLabel}</th>
            <th className="w-[14%] px-4 py-2 text-right">Base Amount</th>
            <th className="w-[14%] px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.length === 0 ? (
            <EmptyRow
              label={
                isIncome
                  ? "No Income category yet — add one via Manage Categories to start tracking recurring income."
                  : "No Expense category yet — add one via Manage Categories to start tracking recurring expenses."
              }
            />
          ) : rows.length === 0 ? (
            <EmptyRow
              label={
                isIncome
                  ? "No recurring income yet — add your salary or other regular inflows below."
                  : "No recurring expenses yet — add your first item below."
              }
            />
          ) : (
            rows.map((row) => {
              const category = categoryById.get(row.categoryId);
              const showCategoryPicker = !row.persisted && categories.length > 1;
              return (
                <tr key={row.id} className="group border-t border-[var(--table-border)] hover:bg-[var(--table-hover-bg)]">
                  <td className="p-0">
                    <input
                      ref={(el) => {
                        nameInputRefs.current[row.id] = el;
                      }}
                      defaultValue={row.name}
                      placeholder={namePlaceholder}
                      onBlur={(e) => onNameBlur(row.id, e.target.value)}
                      className="w-full border-0 bg-transparent px-4 py-2 text-slate-900 dark:text-white focus:outline-2 focus:outline-[var(--table-primary)]"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {showCategoryPicker ? (
                      <select
                        value={row.categoryId}
                        onChange={(e) => onCategoryChange(row.id, e.target.value)}
                        className={`focus-ring rounded px-2 py-1 text-xs font-semibold ${categoryBadgeTone(category?.type)}`}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeTone(category?.type)}`}>
                        {category?.name ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="p-0">
                    <ScheduleDayCell value={row.scheduleDay} onCommit={(v) => onScheduleDayBlur(row.id, v)} />
                  </td>
                  <td className="p-0">
                    <input
                      key={row.paymentMethod ?? ""}
                      type="text"
                      defaultValue={row.paymentMethod ?? ""}
                      placeholder="—"
                      onBlur={(e) => onPaymentMethodBlur(row.id, e.target.value)}
                      className="w-full border-0 bg-transparent px-4 py-2 text-slate-500 dark:text-slate-400 focus:outline-2 focus:outline-[var(--table-primary)]"
                    />
                  </td>
                  <td className="p-0">
                    <input
                      type="number"
                      step="any"
                      value={row.baseAmount}
                      onChange={(e) => onBaseChange(row.id, e.target.value)}
                      onBlur={(e) => onBaseBlur(row.id, e.target.value)}
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
                        onClick={() => onDelete(row.id)}
                        aria-label="Delete"
                        className="text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
          {categories.length > 0 && (
            <tr className="border-t border-[var(--table-border)]">
              <td colSpan={6} className="px-4 py-2">
                <button
                  type="button"
                  onClick={onAddRow}
                  className="focus-ring text-sm font-medium text-blue-600 hover:underline dark:text-lime-400"
                >
                  + Add {isIncome ? "Income" : "Expense"} Row
                </button>
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <CardFooterRow
            label={isIncome ? "Total Recurring Income" : "Total Base Expenses"}
            subtotal={subtotal}
            baseCurrency={baseCurrency}
          />
        </tfoot>
      </table>
    </div>
  );
}

// Auto-synced, read-only card — used for both Debt (EMIs) and SIPs. Row
// rendering (AutoTableRow) and its data-testids are unchanged from before
// this revamp; only the collapsible section-divider wrapper is gone, since
// each now lives in its own always-visible card.
function AutoCardTable({
  icon,
  title,
  rows,
  baseCurrency,
  emptyLabel,
  footerLabel,
  prefix,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  rows: MonthlyBaseAutoRowDTO[];
  baseCurrency: string;
  emptyLabel: string;
  footerLabel: string;
  prefix: "sip-section" | "debt-section";
}) {
  const subtotal = rows.reduce((sum, r) => sum + (Number(r.baseAmount) || 0), 0);
  return (
    <div className="overflow-hidden rounded-lg border-2 border-[var(--table-border)] bg-white shadow-sm dark:bg-canvas-card">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <CardHeaderRow icon={icon} title={title} count={rows.length} subtotal={subtotal} baseCurrency={baseCurrency} />
          <tr
            style={{ backgroundColor: "var(--table-header-bg)", color: "var(--table-header-text)" }}
            className="text-left text-xs font-bold uppercase tracking-wider"
          >
            <th className="w-[26%] px-4 py-2">Commitment</th>
            <th className="w-[18%] px-4 py-2">Category</th>
            <th className="w-[14%] px-4 py-2">Source/Sync</th>
            <th className="w-[14%] px-4 py-2">Schedule</th>
            <th className="w-[14%] px-4 py-2 text-right">Base</th>
            <th className="w-[14%] px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow label={emptyLabel} />
          ) : (
            rows.map((row) => <AutoTableRow key={row.id} row={row} baseCurrency={baseCurrency} prefix={prefix} />)
          )}
        </tbody>
        <tfoot>
          <CardFooterRow label={footerLabel} subtotal={subtotal} baseCurrency={baseCurrency} />
        </tfoot>
      </table>
    </div>
  );
}

// Toggles between a formatted "10th of Month" label (read view, using the
// same ordinal() helper the read-only AutoTableRow uses for dueDay) and a
// plain 1-31 number input while focused — click/tap the label to edit,
// blur to commit via the same onBlur → patchJSON/createRow pattern every
// other field on this page uses.
function ScheduleDayCell({ value, onCommit }: { value: number | null; onCommit: (raw: string) => void }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="w-full px-4 py-2 text-left text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
      >
        {value ? `${ordinal(value)} of Month` : "—"}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      min={1}
      max={31}
      defaultValue={value ?? ""}
      onBlur={(e) => {
        onCommit(e.target.value);
        setEditing(false);
      }}
      className="w-full border-0 bg-transparent px-4 py-2 text-slate-900 dark:text-white focus:outline-2 focus:outline-[var(--table-primary)]"
    />
  );
}

// Read-only row for an auto-linked Debt/SIP line — no edit/delete controls,
// these are sourced from Liabilities/Assets and can only be changed there.
// `prefix` reproduces the pre-revamp data-testid contract exactly
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
