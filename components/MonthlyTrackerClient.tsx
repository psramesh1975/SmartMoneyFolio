"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { computeMonthlySummary } from "@/lib/monthly-summary";
import type {
  MonthlyCategoryDTO,
  MonthlyEntryDTO,
  MonthlyMonthPayload,
} from "@/lib/monthly-types";
import MonthlySheetTable, { type SheetRow } from "@/components/MonthlySheetTable";

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
  categoryId,
  year,
  month,
  onCreated,
  onCancel,
}: {
  categoryId: string;
  year: number;
  month: number;
  onCreated: (entry: MonthlyEntryDTO) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [plannedAmount, setPlannedAmount] = useState("");
  const [actualAmount, setActualAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    onCreated({
      id: data.entry.id,
      categoryId,
      lineItemId: null,
      name,
      baseAmount: String(plannedAmount),
      plannedAmount: String(plannedAmount),
      actualAmount: actualAmount === "" ? null : String(actualAmount),
      isSkipped: false,
      notes: null,
      lineItem: null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border border-line bg-paper-2 p-3">
      <div>
        <label className="block text-xs font-medium text-ink-2">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Car service"
          className="focus-ring mt-1 w-48 border border-line bg-white px-2 py-1 text-sm text-ink"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-2">Planned</label>
        <input
          type="number"
          value={plannedAmount}
          onChange={(e) => setPlannedAmount(e.target.value)}
          className="focus-ring mt-1 w-28 border border-line bg-white px-2 py-1 text-sm text-ink"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-2">Actual (optional)</label>
        <input
          type="number"
          value={actualAmount}
          onChange={(e) => setActualAmount(e.target.value)}
          className="focus-ring mt-1 w-28 border border-line bg-white px-2 py-1 text-sm text-ink"
        />
      </div>
      {error && <p className="w-full text-xs text-coral">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="focus-ring bg-folio px-3 py-1 text-xs text-paper hover:bg-folio-light disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add one-off"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring border border-line bg-white px-3 py-1 text-xs text-ink-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- One category's sheet: table + its one-off form ---
// Category and recurring-line setup itself lives on /monthly/base, not here.

function CategorySection({
  category,
  year,
  month,
  onEntryAdded,
  onEntryUpdated,
  onEntryDeleted,
}: {
  category: MonthlyCategoryDTO;
  year: number;
  month: number;
  onEntryAdded: (categoryId: string, entry: MonthlyEntryDTO) => void;
  onEntryUpdated: (categoryId: string, entry: MonthlyEntryDTO) => void;
  onEntryDeleted: (categoryId: string, entryId: string) => void;
}) {
  const [showAddOneOff, setShowAddOneOff] = useState(false);

  async function handleRemove(entryId: string) {
    const res = await fetch(`/api/monthly/entries/${entryId}`, { method: "DELETE" });
    if (res.ok) onEntryDeleted(category.id, entryId);
  }

  async function handleCellChange(rowId: string, field: string, value: string | boolean) {
    const entry = category.entries.find((e) => e.id === rowId);
    if (!entry) return;

    if (field === "planned") {
      const raw = String(value).trim();
      if (raw === "") return; // planned amount can't be cleared, only changed
      const { ok } = await patchJSON(`/api/monthly/entries/${rowId}`, { plannedAmount: Number(raw) });
      if (ok) onEntryUpdated(category.id, { ...entry, plannedAmount: raw });
    } else if (field === "actual") {
      const raw = String(value).trim();
      const { ok } = await patchJSON(`/api/monthly/entries/${rowId}`, {
        actualAmount: raw === "" ? null : Number(raw),
      });
      if (ok) onEntryUpdated(category.id, { ...entry, actualAmount: raw === "" ? null : raw });
    } else if (field === "remark") {
      const raw = String(value);
      const { ok } = await patchJSON(`/api/monthly/entries/${rowId}`, { notes: raw === "" ? null : raw });
      if (ok) onEntryUpdated(category.id, { ...entry, notes: raw === "" ? null : raw });
    } else if (field === "isSkipped") {
      const checked = Boolean(value);
      const { ok } = await patchJSON(`/api/monthly/entries/${rowId}`, { isSkipped: checked });
      if (ok) onEntryUpdated(category.id, { ...entry, isSkipped: checked });
    }
  }

  const rows: SheetRow[] = category.entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    base: Number(entry.baseAmount),
    planned: Number(entry.plannedAmount),
    actual: entry.actualAmount == null ? null : Number(entry.actualAmount),
    remark: entry.notes,
    isSkipped: entry.isSkipped,
    actions: !entry.lineItemId ? (
      <button type="button" onClick={() => handleRemove(entry.id)} className="text-xs text-coral underline">
        Remove
      </button>
    ) : undefined,
  }));

  const oneOffControl = showAddOneOff ? (
    <AddOneOffForm
      categoryId={category.id}
      year={year}
      month={month}
      onCreated={(entry) => {
        setShowAddOneOff(false);
        onEntryAdded(category.id, entry);
      }}
      onCancel={() => setShowAddOneOff(false)}
    />
  ) : (
    <button
      type="button"
      onClick={() => setShowAddOneOff(true)}
      className="text-xs text-folio underline decoration-dotted"
    >
      + One-off
    </button>
  );

  return (
    <div className="mt-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
        {category.name} — {category.type === "INCOME" ? "Income" : "Outflow"}
      </p>

      {category.entries.length === 0 ? (
        <>
          <p className="mt-1 text-sm text-ink-2">
            Nothing set up in Monthly Base yet for this category —{" "}
            <Link href="/monthly/base" className="text-folio underline">
              set it up there
            </Link>
            , or add a one-off below.
          </p>
          <div className="mt-2">{oneOffControl}</div>
        </>
      ) : (
        <MonthlySheetTable
          categoryName={category.name}
          rows={rows}
          enabledColumns={["planned", "actual"]}
          showSkipColumn={true}
          onCellChange={handleCellChange}
          footerSlot={oneOffControl}
        />
      )}
    </div>
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
  const surplusColor = (n: number) => (n >= 0 ? "text-growth" : "text-coral");
  return (
    <div className="grid grid-cols-1 gap-4 border border-line bg-white p-4 sm:grid-cols-3">
      {[
        { label: "Total Income", planned: summary.plannedIncome, actual: summary.actualIncome },
        { label: "Total Outflow", planned: summary.plannedOutflow, actual: summary.actualOutflow },
      ].map((row) => (
        <div key={row.label}>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">{row.label}</p>
          <p className="mt-1 text-base text-ink">
            Planned: {currency} {fmt(row.planned)}
          </p>
          <p className="text-base text-ink">
            Actual: {currency} {fmt(row.actual)}
          </p>
        </div>
      ))}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Net Surplus</p>
        <p className={`mt-1 text-base ${surplusColor(summary.netSurplusPlanned)}`}>
          Planned: {currency} {fmt(summary.netSurplusPlanned)}
        </p>
        <p className={`text-base ${surplusColor(summary.netSurplusActual)}`}>
          Actual: {currency} {fmt(summary.netSurplusActual)}
        </p>
      </div>
      <p className="text-xs text-ink-2 sm:col-span-3">
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
}: {
  initialPayload: MonthlyMonthPayload;
  currency: string;
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

  return (
    <div className="mt-8 space-y-6">
      <SummaryBar summary={summary} currency={currency} />

      <div>
        {categories.length === 0 ? (
          <p className="text-base text-ink-2">
            No categories yet —{" "}
            <Link href="/monthly/base" className="text-folio underline">
              set them up on Monthly Base
            </Link>
            .
          </p>
        ) : (
          categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              year={year}
              month={month}
              onEntryAdded={handleEntryAdded}
              onEntryUpdated={handleEntryUpdated}
              onEntryDeleted={handleEntryDeleted}
            />
          ))
        )}
      </div>
    </div>
  );
}
