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

// --- One row in a category's table: Base (reference) | Planned | Actual ---

function EntryRow({
  entry,
  currency,
  onUpdated,
  onDeleted,
}: {
  entry: MonthlyEntryDTO;
  currency: string;
  onUpdated: (entry: MonthlyEntryDTO) => void;
  onDeleted: (entryId: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function savePlanned(raw: string) {
    const value = raw.trim();
    if (value === "") return; // planned amount can't be cleared, only changed
    const { ok, data } = await patchJSON(`/api/monthly/entries/${entry.id}`, {
      plannedAmount: Number(value),
    });
    if (!ok) {
      setError(data.error ?? "Couldn't save that.");
      return;
    }
    setError(null);
    onUpdated({ ...entry, plannedAmount: value });
  }

  async function saveActual(raw: string) {
    const value = raw.trim();
    const { ok, data } = await patchJSON(`/api/monthly/entries/${entry.id}`, {
      actualAmount: value === "" ? null : Number(value),
    });
    if (!ok) {
      setError(data.error ?? "Couldn't save that.");
      return;
    }
    setError(null);
    onUpdated({ ...entry, actualAmount: value === "" ? null : value });
  }

  async function saveSkip(checked: boolean) {
    const { ok, data } = await patchJSON(`/api/monthly/entries/${entry.id}`, { isSkipped: checked });
    if (!ok) {
      setError(data.error ?? "Couldn't save that.");
      return;
    }
    onUpdated({ ...entry, isSkipped: checked });
  }

  async function saveNotes(raw: string) {
    const { ok, data } = await patchJSON(`/api/monthly/entries/${entry.id}`, {
      notes: raw === "" ? null : raw,
    });
    if (!ok) {
      setError(data.error ?? "Couldn't save that.");
      return;
    }
    onUpdated({ ...entry, notes: raw === "" ? null : raw });
  }

  async function handleDelete() {
    const res = await fetch(`/api/monthly/entries/${entry.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(entry.id);
  }

  return (
    <>
      <tr className={`border-t border-line ${entry.isSkipped ? "text-ink-2 line-through" : "text-ink"}`}>
        <td className="py-2 pr-2">{entry.name}</td>
        <td className="py-2 pr-2 text-right whitespace-nowrap text-ink-2">
          {currency} {fmt(Number(entry.baseAmount))}
        </td>
        <td className="py-2 pr-2 text-right">
          <input
            type="number"
            defaultValue={entry.plannedAmount}
            disabled={entry.isSkipped}
            onBlur={(e) => savePlanned(e.target.value)}
            className="focus-ring w-28 border border-line bg-white px-2 py-1 text-right text-sm text-ink disabled:bg-paper-2"
          />
        </td>
        <td className="py-2 pr-2 text-right">
          <input
            type="number"
            defaultValue={entry.actualAmount ?? ""}
            placeholder={fmt(Number(entry.plannedAmount)).toString()}
            disabled={entry.isSkipped}
            onBlur={(e) => saveActual(e.target.value)}
            className="focus-ring w-28 border border-line bg-white px-2 py-1 text-right text-sm text-ink disabled:bg-paper-2"
          />
        </td>
        <td className="py-2 pr-2 text-center">
          <input
            type="checkbox"
            defaultChecked={entry.isSkipped}
            onChange={(e) => saveSkip(e.target.checked)}
          />
        </td>
        <td className="py-2 pr-2">
          <input
            type="text"
            defaultValue={entry.notes ?? ""}
            onBlur={(e) => saveNotes(e.target.value)}
            placeholder="Notes"
            className="focus-ring w-full border border-line bg-white px-2 py-1 text-sm text-ink"
          />
        </td>
        <td className="py-2 text-right whitespace-nowrap">
          {!entry.lineItemId && (
            <button type="button" onClick={handleDelete} className="text-xs text-coral underline">
              Remove
            </button>
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={7} className="pb-1 text-xs text-coral">{error}</td>
        </tr>
      )}
    </>
  );
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
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-3 border border-line bg-paper-2 p-3">
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

// --- One category's section: table + its one-off form ---
// Category and recurring-line setup itself lives on /monthly/base, not here.

function CategorySection({
  category,
  currency,
  year,
  month,
  onEntryAdded,
  onEntryUpdated,
  onEntryDeleted,
}: {
  category: MonthlyCategoryDTO;
  currency: string;
  year: number;
  month: number;
  onEntryAdded: (categoryId: string, entry: MonthlyEntryDTO) => void;
  onEntryUpdated: (categoryId: string, entry: MonthlyEntryDTO) => void;
  onEntryDeleted: (categoryId: string, entryId: string) => void;
}) {
  const [showAddOneOff, setShowAddOneOff] = useState(false);

  return (
    <div className="border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink">
          {category.name}{" "}
          <span className="text-xs font-normal uppercase tracking-wide text-ink-2">
            {category.type === "INCOME" ? "Income" : "Outflow"}
          </span>
        </h3>
        <button
          type="button"
          onClick={() => setShowAddOneOff((s) => !s)}
          className="text-xs text-folio underline decoration-dotted"
        >
          + One-off
        </button>
      </div>

      {category.entries.length === 0 ? (
        <p className="mt-3 text-sm text-ink-2">
          Nothing set up in Monthly Base yet for this category —{" "}
          <Link href="/monthly/base" className="text-folio underline">
            set it up there
          </Link>
          , or add a one-off below.
        </p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-ink-2">
              <th className="pb-1 font-medium">Line</th>
              <th className="pb-1 text-right font-medium">Base</th>
              <th className="pb-1 text-right font-medium">Planned</th>
              <th className="pb-1 text-right font-medium">Actual</th>
              <th className="pb-1 text-center font-medium">Skip</th>
              <th className="pb-1 font-medium">Notes</th>
              <th className="pb-1" />
            </tr>
          </thead>
          <tbody>
            {category.entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                currency={currency}
                onUpdated={(e) => onEntryUpdated(category.id, e)}
                onDeleted={(id) => onEntryDeleted(category.id, id)}
              />
            ))}
          </tbody>
        </table>
      )}

      {showAddOneOff && (
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

      <div className="space-y-4">
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
              currency={currency}
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
