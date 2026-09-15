"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { computeMonthlySummary } from "@/lib/monthly-summary";
import { formatCurrency } from "@/lib/format-currency";
import type {
  MonthlyCategoryDTO,
  MonthlyCategoryOptionDTO,
  MonthlyEntryDTO,
  MonthlyMonthPayload,
} from "@/lib/monthly-types";
import MonthlyFlatTableCard, { type FlatRow } from "@/components/MonthlyFlatTable";
import MonthlyBreakdownPanel from "@/components/MonthlyBreakdownPanel";

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

// --- Add-one-off mini form, per category ---

function AddOneOffForm({
  categories,
  year,
  month,
  onCreated,
  onCancel,
}: {
  categories: MonthlyCategoryOptionDTO[];
  year: number;
  month: number;
  onCreated: (categoryId: string, entry: MonthlyEntryDTO) => void;
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [name, setName] = useState("");
  const [plannedAmount, setPlannedAmount] = useState("");
  const [actualAmount, setActualAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    if (!name.trim() || !plannedAmount) {
      setError("Give it a name and a planned amount.");
      return;
    }
    setSaving(true);
    setError(null);
    const { ok, data } = await postJSON("/api/monthly/entries", {
      categoryId,
      year,
      month,
      name,
      plannedAmount: Number(plannedAmount),
      actualAmount: actualAmount === "" ? undefined : Number(actualAmount),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Couldn't add that.");
      return;
    }
    onCreated(categoryId, {
      id: data.entry.id,
      categoryId,
      lineItemId: null,
      name,
      baseAmount: String(plannedAmount),
      plannedAmount: String(plannedAmount),
      actualAmount: actualAmount === "" ? null : String(actualAmount),
      isSkipped: false,
      notes: null,
      scheduledDay: null,
      lineItem: null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-canvas-card">
      {categories.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="focus-ring mt-1 w-48 border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Car service"
          className="focus-ring mt-1 w-48 border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Planned</label>
        <input
          type="number"
          value={plannedAmount}
          onChange={(e) => setPlannedAmount(e.target.value)}
          className="focus-ring mt-1 w-28 border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Actual (optional)</label>
        <input
          type="number"
          value={actualAmount}
          onChange={(e) => setActualAmount(e.target.value)}
          className="focus-ring mt-1 w-28 border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
        />
      </div>
      {error && <p className="w-full text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="focus-ring rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--table-primary)" }}
        >
          {saving ? "Adding…" : "Add one-off"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-canvas-card dark:text-slate-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- One-off control, scoped to one side (Income or Outflow) of the ledger.

function OneOffControl({
  categories,
  year,
  month,
  addLabel,
  onCreated,
}: {
  categories: MonthlyCategoryOptionDTO[];
  year: number;
  month: number;
  addLabel: string;
  onCreated: (categoryId: string, entry: MonthlyEntryDTO) => void;
}) {
  const [showAddOneOff, setShowAddOneOff] = useState(false);

  if (!showAddOneOff) {
    return (
      <button
        type="button"
        onClick={() => setShowAddOneOff(true)}
        className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">+</span>
        <span>{addLabel}</span>
      </button>
    );
  }

  return (
    <AddOneOffForm
      categories={categories}
      year={year}
      month={month}
      onCreated={(categoryId, entry) => {
        setShowAddOneOff(false);
        onCreated(categoryId, entry);
      }}
      onCancel={() => setShowAddOneOff(false)}
    />
  );
}

// --- 3-metric scorecard — same visual language as Monthly Base's own
// scorecard (numbered badges, colored pills, big mono numbers), so the
// month-tracking pages and Monthly Base read as one consistent system.

function SummaryScorecard({
  summary,
  currency,
}: {
  summary: ReturnType<typeof computeMonthlySummary>;
  currency: string;
}) {
  const netNegative = summary.netSurplusActual < 0;
  const outflowVariance = summary.actualOutflow - summary.plannedOutflow;
  const bufferPercent =
    summary.actualIncome > 0 ? Math.round((summary.netSurplusActual / summary.actualIncome) * 100) : 0;

  return (
    <div
      className="rounded-2xl border-2 bg-white p-5 shadow-sm dark:bg-canvas-card sm:p-6"
      style={{ borderColor: "var(--table-border)" }}
    >
      <div className="grid grid-cols-1 gap-5 divide-y divide-slate-100 dark:divide-slate-800 sm:grid-cols-3 sm:gap-6 sm:divide-x sm:divide-y-0">
        {/* 1. Total Inflow */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              1. Total Inflow
            </span>
            <span className="rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
              Inflow
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-emerald-600 [font-variant-numeric:tabular-nums] dark:text-emerald-400 sm:text-3xl">
            {formatCurrency(summary.actualIncome, currency)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Planned: {formatCurrency(summary.plannedIncome, currency)}
          </p>
        </div>

        {/* 2. Consolidated Outflow */}
        <div className="space-y-1 pt-4 sm:pl-6 sm:pt-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              2. Consolidated Outflow
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                outflowVariance > 0
                  ? "border-rose-200/60 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300"
                  : "border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
              }`}
            >
              {outflowVariance > 0
                ? `↑ ${formatCurrency(outflowVariance, currency)} Over Plan`
                : outflowVariance < 0
                  ? `↓ ${formatCurrency(Math.abs(outflowVariance), currency)} Under Plan`
                  : "On Plan"}
            </span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-rose-600 [font-variant-numeric:tabular-nums] dark:text-rose-400 sm:text-3xl">
            {formatCurrency(summary.actualOutflow, currency)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Planned: {formatCurrency(summary.plannedOutflow, currency)}
          </p>
        </div>

        {/* 3. Net Monthly Buffer */}
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
              {bufferPercent}% {netNegative ? "Over" : "Retained"}
            </span>
          </div>
          <div
            className={`font-mono text-2xl font-extrabold [font-variant-numeric:tabular-nums] sm:text-3xl ${
              netNegative ? "text-rose-600 dark:text-rose-400" : "text-indigo-600 dark:text-lime-400"
            }`}
          >
            {formatCurrency(summary.netSurplusActual, currency)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Planned: {formatCurrency(summary.netSurplusPlanned, currency)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        * Actual totals count any line without an entered actual as its planned amount, so the running number
        stays meaningful mid-month. Base is a reference only and isn't summed here.
      </p>
    </div>
  );
}

// --- Root client component ---

export default function MonthlyTrackerClient({
  initialPayload,
  currency,
  period,
}: {
  initialPayload: MonthlyMonthPayload;
  currency: string;
  period: "current" | "previous" | "next";
}) {
  const router = useRouter();
  const { year, month } = initialPayload;
  const [categories, setCategories] = useState<MonthlyCategoryDTO[]>(initialPayload.categories);

  const summary = useMemo(
    () =>
      computeMonthlySummary(
        categories.flatMap((c) =>
          c.entries.map((e) => ({
            categoryType: c.type,
            plannedAmount: e.plannedAmount,
            actualAmount: e.actualAmount,
            isSkipped: e.isSkipped,
          }))
        )
      ),
    [categories]
  );

  function handleEntryAdded(categoryId: string, entry: MonthlyEntryDTO) {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, entries: [...c.entries, entry] } : c))
    );
    router.refresh();
  }

  function handleEntryUpdated(categoryId: string, entry: MonthlyEntryDTO) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? { ...c, entries: c.entries.map((e) => (e.id === entry.id ? entry : e)) }
          : c
      )
    );
    router.refresh();
  }

  function handleEntryDeleted(categoryId: string, entryId: string) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId ? { ...c, entries: c.entries.filter((e) => e.id !== entryId) } : c
      )
    );
    router.refresh();
  }

  function findEntry(entryId: string) {
    for (const category of categories) {
      const entry = category.entries.find((e) => e.id === entryId);
      if (entry) return { categoryId: category.id, entry };
    }
    return null;
  }

  async function handleRemove(categoryId: string, entryId: string) {
    const res = await fetch(`/api/monthly/entries/${entryId}`, { method: "DELETE" });
    if (res.ok) handleEntryDeleted(categoryId, entryId);
  }

  // Categories arrive pre-sorted by sortOrder, and each category's entries
  // pre-sorted by createdAt. Built once per category type, so Income and
  // Outflow entries are never in the same array, let alone the same table —
  // that separation is the whole point of this page.
  function buildRows(type: "INCOME" | "OUTFLOW"): FlatRow[] {
    return categories
      .filter((c) => c.type === type)
      .flatMap((category) =>
        category.entries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          categoryName: category.name,
          base: Number(entry.baseAmount),
          planned: Number(entry.plannedAmount),
          actual: entry.actualAmount == null ? null : Number(entry.actualAmount),
          remark: entry.notes,
          isSkipped: entry.isSkipped,
          actions: !entry.lineItemId ? (
            <button
              type="button"
              onClick={() => handleRemove(category.id, entry.id)}
              className="text-[11px] font-bold text-rose-600 hover:underline dark:text-rose-400"
            >
              Remove
            </button>
          ) : undefined,
        }))
      );
  }

  const incomeRows = useMemo(() => buildRows("INCOME"), [categories]);
  const outflowRows = useMemo(() => buildRows("OUTFLOW"), [categories]);
  const incomeCategories = categories.filter((c) => c.type === "INCOME");
  const outflowCategories = categories.filter((c) => c.type === "OUTFLOW");

  async function handleCellChange(
    rowId: string,
    field: "planned" | "actual" | "remark" | "isSkipped",
    value: string | boolean
  ) {
    const found = findEntry(rowId);
    if (!found) return;
    const { categoryId, entry } = found;

    if (field === "planned") {
      const raw = String(value).trim();
      if (raw === "") return; // planned amount can't be cleared, only changed
      const { ok } = await patchJSON(`/api/monthly/entries/${rowId}`, { plannedAmount: Number(raw) });
      if (ok) handleEntryUpdated(categoryId, { ...entry, plannedAmount: raw });
    } else if (field === "actual") {
      const raw = String(value).trim();
      const { ok } = await patchJSON(`/api/monthly/entries/${rowId}`, {
        actualAmount: raw === "" ? null : Number(raw),
      });
      if (ok) handleEntryUpdated(categoryId, { ...entry, actualAmount: raw === "" ? null : raw });
    } else if (field === "remark") {
      const raw = String(value);
      const { ok } = await patchJSON(`/api/monthly/entries/${rowId}`, { notes: raw === "" ? null : raw });
      if (ok) handleEntryUpdated(categoryId, { ...entry, notes: raw === "" ? null : raw });
    } else if (field === "isSkipped") {
      const checked = Boolean(value);
      const { ok } = await patchJSON(`/api/monthly/entries/${rowId}`, { isSkipped: checked });
      if (ok) handleEntryUpdated(categoryId, { ...entry, isSkipped: checked });
    }
  }

  const outflowVariance = summary.actualOutflow - summary.plannedOutflow;

  return (
    <div className="mt-8 space-y-6">
      <SummaryScorecard summary={summary} currency={currency} />

      {categories.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No categories yet —{" "}
          <Link href="/monthly/base" className="text-blue-600 underline dark:text-lime-400">
            set them up on Monthly Base
          </Link>
          .
        </p>
      ) : (
        <>
          <MonthlyFlatTableCard
            title="Inflow & Income (Money In)"
            pillLabel="Received This Month"
            dotClassName="bg-emerald-400"
            itemColumnLabel="Inflow Source"
            namePlaceholderIsIncome
            hasCategories={incomeCategories.length > 0}
            noCategoryLabel="No Income category yet — add one via Manage Categories on Monthly Base to start tracking income."
            rows={incomeRows}
            currency={currency}
            onCellChange={handleCellChange}
            oneOffSlot={
              incomeCategories.length > 0 ? (
                <OneOffControl
                  categories={incomeCategories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    spendKind: c.spendKind,
                    isSubscription: c.isSubscription,
                  }))}
                  year={year}
                  month={month}
                  addLabel="+ Add One-Off Income"
                  onCreated={handleEntryAdded}
                />
              ) : undefined
            }
          />

          <MonthlyFlatTableCard
            title="Monthly Outflows (Debts, Living Bills, Subscriptions & Savings SIPs)"
            pillLabel="Paid This Month"
            dotClassName="bg-rose-400"
            itemColumnLabel="Outflow Line Item"
            namePlaceholderIsIncome={false}
            hasCategories={outflowCategories.length > 0}
            noCategoryLabel="No Expense category yet — add one via Manage Categories on Monthly Base to start tracking outflows."
            rows={outflowRows}
            currency={currency}
            onCellChange={handleCellChange}
            oneOffSlot={
              outflowCategories.length > 0 ? (
                <OneOffControl
                  categories={outflowCategories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    spendKind: c.spendKind,
                    isSubscription: c.isSubscription,
                  }))}
                  year={year}
                  month={month}
                  addLabel="+ Add One-Off Outflow"
                  onCreated={handleEntryAdded}
                />
              ) : undefined
            }
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
                  Total {period === "current" ? "This Month's" : period === "previous" ? "Previous Month's" : "Next Month's"} Outflow
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold">
                  {outflowVariance > 0
                    ? `↑ ${formatCurrency(outflowVariance, currency)} Over Plan`
                    : outflowVariance < 0
                      ? `↓ ${formatCurrency(Math.abs(outflowVariance), currency)} Under Plan`
                      : "On Plan"}
                </span>
              </div>
              <p className="mt-1 text-xs opacity-70">
                Consolidates debt servicing, routine living overhead, subscriptions, and SIP savings — Income is
                never included in this figure.
              </p>
            </div>

            <div className="text-right">
              <div className="font-mono text-3xl font-extrabold tracking-tight [font-variant-numeric:tabular-nums]">
                {formatCurrency(summary.actualOutflow, currency)}
              </div>
              <span className="text-[11px] opacity-70">Consolidated Money Out</span>
            </div>
          </div>
        </>
      )}

      {period !== "next" && (
        <MonthlyBreakdownPanel year={year} month={month} period={period} currency={currency} />
      )}
    </div>
  );
}
