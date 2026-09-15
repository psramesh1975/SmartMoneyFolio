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
import { categoryBadgeTone } from "@/lib/monthly-badge";
import ManageCategoriesPanel from "@/components/ManageCategoriesPanel";

// ─────────────────────────────────────────────────────────────────────────
// This file matches the "Monthly Base" reference mockup (Monthly_-_Base.html)
// structure, copy, spacing and row styling exactly: top header with the
// MASTER BLUEPRINT eyebrow + two buttons, the 3-column metric scorecard,
// four bordered card-tables each with a colored-dot header bar and a
// header-only subtotal (no separate footer total row — the mockup doesn't
// have one), and the dark grand-total bar at the very bottom.
//
// Two deliberate departures from the mockup, both intentional:
//  1. Colors come from the household's live table theme (--table-* CSS vars,
//     Household.tableTheme, 8 presets — already shipped/locked) instead of
//     the mockup's hardcoded slate-950. Selecting the "Jet Black" preset
//     reproduces the mockup's exact look; every other preset gets the same
//     structure in its own palette.
//  2. The mockup's "+ Add Recurring Row" opens a prompt()/modal demo with no
//     real save logic. This keeps the app's actual working flow — click
//     "+ Add …" → a blank row appears inline → type a name → blur to save
//     via the real API — restyled to match the mockup's buttons exactly.
// ─────────────────────────────────────────────────────────────────────────

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

// Deterministic name → tone mapping so persisted category chips get the
// same kind of color variety the mockup shows (Salary=green, Rental=blue,
// Housing=amber, Education=indigo, …) without a schema change — the schema
// only stores INCOME/OUTFLOW, not a per-category color.
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
  const netNegative = kpis.netBufferPercent < 0;

  return (
    <div className="space-y-6">
      {/* ================= TOP HEADER ================= */}
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between"
           style={{ borderColor: "var(--table-border)" }}>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-md border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
              Master Blueprint
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-600">•</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">100% {baseCurrency} Standard</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            Monthly Base Setup
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Define baseline recurring income, debt commitments, and living expenses. This template automatically
            populates each new tracking month.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowManageCategories((s) => !s)}
            className="rounded-xl border-2 bg-white px-3.5 py-2 text-xs font-bold shadow-sm transition active:scale-95 dark:bg-canvas-card"
            style={{ borderColor: "var(--table-primary)", color: "var(--table-primary)" }}
          >
            {showManageCategories ? "Hide Categories" : "Manage Categories"}
          </button>
          <button
            type="button"
            onClick={() => handleAddRow("expense")}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
            style={{ backgroundColor: "var(--table-primary)" }}
          >
            <span>+ Add Recurring Row</span>
          </button>
        </div>
      </div>

      {showManageCategories && (
        <ManageCategoriesPanel
          categories={categories}
          onCategoryCreated={handleCategoryCreated}
          onCategoryUpdated={handleCategoryUpdated}
          onCategoryDeleted={handleCategoryDeleted}
        />
      )}

      {/* ================= 3-COLUMN METRIC SCORECARD ================= */}
      <div className="rounded-2xl border-2 bg-white p-5 shadow-sm dark:bg-canvas-card sm:p-6"
           style={{ borderColor: "var(--table-border)" }}>
        <div className="grid grid-cols-1 gap-5 divide-y divide-slate-100 dark:divide-slate-800 sm:grid-cols-3 sm:gap-6 sm:divide-x sm:divide-y-0">
          {/* Metric 1: Total Inflow */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Expected Monthly Income
              </span>
              <span className="rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
                Inflow
              </span>
            </div>
            <div className="font-mono text-2xl font-extrabold text-emerald-600 [font-variant-numeric:tabular-nums] dark:text-emerald-400 sm:text-3xl">
              {formatCurrency(kpis.totalIncome, baseCurrency)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Fixed salary &amp; recurring receipts</p>
          </div>

          {/* Metric 2: Total Outflow */}
          <div className="space-y-1 pt-4 sm:pl-6 sm:pt-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Total Base Outflow
              </span>
              <span className="rounded-full border border-rose-200/60 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
                Debt + Expense
              </span>
            </div>
            <div className="font-mono text-2xl font-extrabold text-rose-600 [font-variant-numeric:tabular-nums] dark:text-rose-400 sm:text-3xl">
              {formatCurrency(kpis.totalOutflow, baseCurrency)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatCurrency(kpis.wealthBuilding, baseCurrency)} Wealth Building + {formatCurrency(kpis.fixedLiving, baseCurrency)} Living
            </p>
          </div>

          {/* Metric 3: Planned Monthly Surplus */}
          <div className="space-y-1 pt-4 sm:pl-6 sm:pt-0">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {netNegative && <AlertTriangle size={12} className="text-rose-600 dark:text-rose-400" />}
                3. Net Monthly Buffer
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                  netNegative
                    ? "border-rose-200/60 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300"
                    : "border-indigo-200/60 bg-indigo-50 text-indigo-700 dark:border-lime-400/30 dark:bg-lime-400/10 dark:text-lime-300"
                }`}
              >
                {kpis.netBufferPercent}% {netNegative ? "Over" : "Saved"}
              </span>
            </div>
            <div
              className={`font-mono text-2xl font-extrabold [font-variant-numeric:tabular-nums] sm:text-3xl ${
                netNegative ? "text-rose-600 dark:text-rose-400" : "text-indigo-600 dark:text-lime-400"
              }`}
            >
              {formatCurrency(kpis.netBuffer, baseCurrency)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Unallocated free cash flow</p>
          </div>
        </div>
      </div>

      {/* ================= FOUR CARD-TABLES, mockup order: Income, Debt, SIPs, Expenses ================= */}
      <ManualCardTable
        kind="income"
        title="Recurring Inflows &amp; Income Sources"
        pillLabel="Cash Baseline"
        subtotalLabel="Inflow Subtotal"
        dotClassName="bg-emerald-400"
        addLabel="+ Add Recurring Income Row"
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
        title="Liabilities &amp; Debt Servicing (EMIs)"
        pillLabel="Auto-Synced from Liabilities ↗"
        subtotalLabel="Debt Subtotal"
        dotClassName="bg-rose-400"
        noteText="Pulled dynamically from active loan folios in Liabilities & Debt."
        itemColumnLabel="Loan / Liability"
        amountColumnLabel="Monthly EMI"
        rows={payload.debtRows}
        baseCurrency={baseCurrency}
        emptyLabel="No loan EMIs yet — set an EMI amount on a Liability to see it here."
        prefix="debt-section"
      />

      <AutoCardTable
        icon={TrendingUp}
        title="Investments &amp; SIPs"
        pillLabel="Auto-Synced from Assets ↗"
        subtotalLabel="SIP Subtotal"
        dotClassName="bg-violet-400"
        noteText="Pulled dynamically from active SIP folios in Assets."
        itemColumnLabel="Investment / SIP"
        amountColumnLabel="Monthly SIP"
        rows={payload.sipRows}
        baseCurrency={baseCurrency}
        emptyLabel="No active SIPs yet — set a SIP amount on an Asset to see it here."
        prefix="sip-section"
      />

      <ManualCardTable
        kind="expense"
        title="Monthly Base Expenses &amp; Overhead"
        pillLabel="Household Living Operating Costs"
        subtotalLabel="Expense Subtotal"
        dotClassName="bg-amber-400"
        addLabel="+ Add Recurring Expense Row"
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

      {/* ================= GRAND TOTAL SUMMARY FOOTER ================= */}
      <div
        className="flex flex-col items-center justify-between gap-4 rounded-2xl border-2 p-5 shadow-lg sm:flex-row sm:p-6"
        style={{
          backgroundColor: "var(--table-footer-bg)",
          color: "var(--table-footer-text)",
          borderColor: "var(--table-footer-bg)",
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider opacity-70">
              Total Monthly Base Outflow
            </span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold">Active Blueprint</span>
          </div>
          <p className="mt-1 text-xs opacity-70">
            Carried forward automatically into each tracking month as planned baseline expenditure.
          </p>
        </div>

        <div className="text-right">
          <div className="font-mono text-3xl font-extrabold tracking-tight [font-variant-numeric:tabular-nums]">
            {formatCurrency(kpis.totalOutflow, baseCurrency)}
          </div>
          <span className="text-[11px] opacity-70">100% Consolidated Outflow (Debt + Living)</span>
        </div>
      </div>
    </div>
  );
}

// Header bar shared by every card: colored dot, title, translucent pill
// (tinted from the header's own text color so it reads correctly on every
// table theme, light or dark), and the header-only subtotal on the right —
// the mockup has no separate footer total row, so none is rendered here.
function CardHeaderRow({
  dotClassName,
  title,
  pillLabel,
  subtotalLabel,
  subtotal,
  baseCurrency,
}: {
  dotClassName: string;
  title: string;
  pillLabel: string;
  subtotalLabel: string;
  subtotal: number;
  baseCurrency: string;
}) {
  return (
    <tr style={{ backgroundColor: "var(--table-header-bg)", color: "var(--table-header-text)" }}>
      <th colSpan={6} className="px-4 py-3 text-left font-normal sm:px-5">
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
            {subtotalLabel}: <strong className="text-sm font-bold">{formatCurrency(subtotal, baseCurrency)}</strong>
          </div>
        </div>
      </th>
    </tr>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <tr className="border-t" style={{ borderColor: "var(--table-border)" }}>
      <td colSpan={6} className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">
        {label}
      </td>
    </tr>
  );
}

// Manual, editable card — used for both Income and Expense. Which card a
// row belongs to, its labels, and its placeholder text all key off `kind`;
// everything else (inline edit, add-row, delete) is identical.
function ManualCardTable({
  kind,
  title,
  pillLabel,
  subtotalLabel,
  dotClassName,
  addLabel,
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
  title: string;
  pillLabel: string;
  subtotalLabel: string;
  dotClassName: string;
  addLabel: string;
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
  const itemColumnLabel = isIncome ? "Inflow Source" : "Expense / Item";
  const scheduleColumnLabel = isIncome ? "Credit Day" : "Schedule";
  const methodColumnLabel = isIncome ? "Account / Mode" : "Payment Method";
  const namePlaceholder = isIncome ? "Salary, rental income…" : "Expense description…";
  const subtotal = rows.reduce((sum, r) => sum + (Number(r.baseAmount) || 0), 0);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

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
              subtotalLabel={subtotalLabel}
              subtotal={subtotal}
              baseCurrency={baseCurrency}
            />
            <tr className="border-b bg-slate-100 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-white/5 dark:text-slate-300">
              <th className="w-[26%] py-3 px-5">{itemColumnLabel}</th>
              <th className="w-[18%] py-3 px-4">Category</th>
              <th className="w-[14%] py-3 px-4">{scheduleColumnLabel}</th>
              <th className="w-[14%] py-3 px-4">{methodColumnLabel}</th>
              <th className="w-[14%] py-3 px-5 text-right">Base Amount</th>
              <th className="w-[14%] py-3 px-5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800">
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
                  <tr key={row.id} className="transition hover:bg-slate-50/70 dark:hover:bg-white/5">
                    <td className="p-0">
                      <input
                        ref={(el) => {
                          nameInputRefs.current[row.id] = el;
                        }}
                        defaultValue={row.name}
                        placeholder={namePlaceholder}
                        onBlur={(e) => onNameBlur(row.id, e.target.value)}
                        className="w-full border-0 bg-transparent px-5 py-3.5 text-sm font-extrabold text-slate-900 focus:outline-2 focus:outline-[var(--table-primary)] dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      {showCategoryPicker ? (
                        <select
                          value={row.categoryId}
                          onChange={(e) => onCategoryChange(row.id, e.target.value)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-bold focus:outline-2 focus:outline-[var(--table-primary)] ${categoryBadgeTone(
                            category?.type
                          )}`}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-block rounded-md border px-2.5 py-1 text-[11px] font-bold ${categoryChipTone(
                            category?.name ?? ""
                          )}`}
                        >
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
                        className="w-full border-0 bg-transparent px-4 py-3.5 text-slate-600 focus:outline-2 focus:outline-[var(--table-primary)] dark:text-slate-400"
                      />
                    </td>
                    <td className="p-0">
                      <input
                        type="number"
                        step="any"
                        value={row.baseAmount}
                        onChange={(e) => onBaseChange(row.id, e.target.value)}
                        onBlur={(e) => onBaseBlur(row.id, e.target.value)}
                        className="w-full border-0 bg-transparent px-5 py-3.5 text-right font-mono text-sm font-bold text-slate-950 [font-variant-numeric:tabular-nums] focus:outline-2 focus:outline-[var(--table-primary)] dark:text-white"
                      />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => nameInputRefs.current[row.id]?.focus()}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row.id)}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-400 dark:hover:bg-rose-400/10"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {categories.length > 0 && (
        <div className="flex justify-center border-t border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-white/5">
          <button
            type="button"
            onClick={onAddRow}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">+</span>
            <span>{addLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Auto-synced, read-only card — used for both Debt (EMIs) and SIPs. A thin
// note bar under the header explains the sync source, matching the
// mockup's "Pulled dynamically from…" strip on the Debt table.
function AutoCardTable({
  icon,
  title,
  pillLabel,
  subtotalLabel,
  dotClassName,
  noteText,
  itemColumnLabel,
  amountColumnLabel,
  rows,
  baseCurrency,
  emptyLabel,
  prefix,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  pillLabel: string;
  subtotalLabel: string;
  dotClassName: string;
  noteText: string;
  itemColumnLabel: string;
  amountColumnLabel: string;
  rows: MonthlyBaseAutoRowDTO[];
  baseCurrency: string;
  emptyLabel: string;
  prefix: "sip-section" | "debt-section";
}) {
  const subtotal = rows.reduce((sum, r) => sum + (Number(r.baseAmount) || 0), 0);
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
              subtotalLabel={subtotalLabel}
              subtotal={subtotal}
              baseCurrency={baseCurrency}
            />
            <tr className="border-b bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-white/5 dark:text-slate-400">
              <td colSpan={6} className="px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <Icon icon={icon} />
                  <span>{noteText}</span>
                </div>
              </td>
            </tr>
            <tr className="border-b bg-slate-100 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-white/5 dark:text-slate-300">
              <th className="w-[26%] py-3 px-5">{itemColumnLabel}</th>
              <th className="w-[18%] py-3 px-4">Category</th>
              <th className="w-[14%] py-3 px-4">Linked Folio</th>
              <th className="w-[14%] py-3 px-4">Schedule</th>
              <th className="w-[14%] py-3 px-5 text-right">{amountColumnLabel}</th>
              <th className="w-[14%] py-3 px-5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800">
            {rows.length === 0 ? (
              <EmptyRow label={emptyLabel} />
            ) : (
              rows.map((row) => <AutoTableRow key={row.id} row={row} baseCurrency={baseCurrency} prefix={prefix} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Icon({ icon: I }: { icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return <I size={14} className="shrink-0 text-slate-500 dark:text-slate-400" />;
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
        className="w-full px-4 py-3.5 text-left font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
      >
        {value ? `${ordinal(value)} of month` : "—"}
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
      className="w-full border-0 bg-transparent px-4 py-3.5 text-slate-900 focus:outline-2 focus:outline-[var(--table-primary)] dark:text-white"
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
      className="transition hover:bg-slate-50/70 dark:hover:bg-white/5"
    >
      <td className="px-5 py-3.5">
        <div className="text-sm font-extrabold text-slate-900 dark:text-white">{row.name}</div>
        {row.subtitle && <div className="text-[11px] text-slate-400 dark:text-slate-500">{row.subtitle}</div>}
      </td>
      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
        {isSip ? "Investments & SIPs" : "Debt & Loan Obligations"}
      </td>
      <td className="px-4 py-3.5">
        {row.sourceId ? (
          <Link
            href={sourceHref}
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-lime-400"
          >
            <span>{sourceLabel.replace(" ↗", "")}</span>
            <span className="text-[10px]">↗</span>
          </Link>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
        {row.dueDay ? `${ordinal(row.dueDay)} of month` : "—"}
      </td>
      <td className="px-5 py-3.5 text-right font-mono text-sm font-bold text-slate-950 [font-variant-numeric:tabular-nums] dark:text-white">
        {formatCurrency(row.baseAmount, baseCurrency)}
      </td>
      <td className="px-5 py-3.5 text-center">
        <span
          data-testid={`${prefix}-row-badge-${row.id}`}
          className="rounded px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400"
          style={{ backgroundColor: "var(--table-hover-bg)" }}
        >
          Synced 🔒
        </span>
      </td>
    </tr>
  );
}
