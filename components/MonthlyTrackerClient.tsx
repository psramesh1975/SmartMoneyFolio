"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { computeMonthlySummary } from "@/lib/monthly-summary";
import type {
  MonthlyCategoryDTO,
  MonthlyCategoryOptionDTO,
  MonthlyEntryDTO,
  MonthlyMonthPayload,
} from "@/lib/monthly-types";
import MonthlyFlatTable, { type FlatRow } from "@/components/MonthlyFlatTable";
import MonthlyBreakdownPanel from "@/components/MonthlyBreakdownPanel";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-white/5">
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
                {c.name} — {c.type === "INCOME" ? "Income" : "Outflow"}
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
          className="focus-ring bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-lime-400 dark:text-slate-900 dark:hover:bg-lime-300"
        >
          {saving ? "Adding…" : "Add one-off"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring border border-slate-200/80 bg-white px-3 py-1 text-xs text-slate-500 dark:border-slate-800 dark:bg-canvas-card dark:text-slate-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- Bottom-of-page one-off control, for any category. Category/recurring
// setup itself lives on /monthly/base, not here.

function BottomOneOff({
  categories,
  year,
  month,
  onCreated,
}: {
  categories: MonthlyCategoryOptionDTO[];
  year: number;
  month: number;
  onCreated: (categoryId: string, entry: MonthlyEntryDTO) => void;
}) {
  const [showAddOneOff, setShowAddOneOff] = useState(false);

  if (!showAddOneOff) {
    return (
      <button
        type="button"
        onClick={() => setShowAddOneOff(true)}
        className="text-sm text-blue-600 underline decoration-dotted dark:text-lime-400"
      >
        + One-off
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

// --- Summary bar ---

function SummaryBar({
  summary,
  currency,
}: {
  summary: ReturnType<typeof computeMonthlySummary>;
  currency: string;
}) {
  const surplusColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-cyan-400" : "text-rose-600 dark:text-rose-400");
  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40 sm:grid-cols-3">
      {[
        { label: "Total Income", planned: summary.plannedIncome, actual: summary.actualIncome },
        { label: "Total Outflow", planned: summary.plannedOutflow, actual: summary.actualOutflow },
      ].map((row) => (
        <div key={row.label}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{row.label}</p>
          <p className="mt-1 text-sm text-slate-900 dark:text-white">
            Planned: {currency} {fmt(row.planned)}
          </p>
          <p className="text-sm text-slate-900 dark:text-white">
            Actual: {currency} {fmt(row.actual)}
          </p>
        </div>
      ))}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Net Surplus</p>
        <p className={`mt-1 text-sm ${surplusColor(summary.netSurplusPlanned)}`}>
          Planned: {currency} {fmt(summary.netSurplusPlanned)}
        </p>
        <p className={`text-sm ${surplusColor(summary.netSurplusActual)}`}>
          Actual: {currency} {fmt(summary.netSurplusActual)}
        </p>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-3">
        * Actual totals count any line without an entered actual as its planned amount, so the
        running number stays meaningful mid-month. Base is a reference only and isn't summed here.
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

  // Categories arrive pre-sorted by sortOrder, and each category's entries
  // pre-sorted by createdAt — flattening in this order is already "category
  // sortOrder, then entry createdAt", no re-sort needed.
  const flatRows: FlatRow[] = useMemo(
    () =>
      categories.flatMap((category) =>
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
              className="text-xs text-rose-600 underline dark:text-rose-400"
            >
              Remove
            </button>
          ) : undefined,
        }))
      ),
    [categories]
  );

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

  return (
    <div className="mt-8 space-y-6">
      <SummaryBar summary={summary} currency={currency} />

      <div>
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
            <MonthlyFlatTable rows={flatRows} onCellChange={handleCellChange} />

            <div className="mt-4">
              <BottomOneOff
                categories={categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  type: c.type,
                  spendKind: c.spendKind,
                  isSubscription: c.isSubscription,
                }))}
                year={year}
                month={month}
                onCreated={handleEntryAdded}
              />
            </div>
          </>
        )}
      </div>

      {period !== "next" && (
        <MonthlyBreakdownPanel year={year} month={month} period={period} currency={currency} />
      )}
    </div>
  );
}
