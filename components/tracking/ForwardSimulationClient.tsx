"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ForwardSimulationPage, { type CommitmentRow } from "@/components/tracking/ForwardSimulationPage";
import type { MonthlyCategoryOptionDTO } from "@/lib/monthly-types";

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// "+ Log Advance Expense" wasn't supplied as a file — this modal is new UI
// built to fulfil the setup note ("open an entry modal/form scoped to this
// specific draft month, and persist the new row as an Advance Entry"),
// following the same postJSON-to-/api/monthly/entries pattern already used
// by Current/Next Month's own one-off form (components/MonthlyTrackerClient.tsx).
function LogAdvanceExpenseModal({
  year,
  month,
  categoryOptions,
  onClose,
  onSaved,
}: {
  year: number;
  month: number;
  categoryOptions: MonthlyCategoryOptionDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoryId, setCategoryId] = useState(categoryOptions[0]?.id ?? "");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    if (!name.trim() || !amount) {
      setError("Give it a name and an amount.");
      return;
    }
    setSaving(true);
    setError(null);
    const { ok, data } = await postJSON("/api/monthly/entries", {
      categoryId,
      year,
      month,
      name: name.trim(),
      plannedAmount: Number(amount),
      scheduledDay: day ? Number(day) : undefined,
      notes: note.trim() || undefined,
    });
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Couldn't log that expense.");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-extrabold text-slate-900">Log Advance Expense</h3>
        <p className="mt-1 text-xs text-slate-500">
          Records a planned outflow for this draft month only — it never touches real balances.
        </p>

        {categoryOptions.length === 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">
              No expense categories yet — add one on Monthly Base first, then come back here.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="focus-ring mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
            >
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Expense name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Diwali flight booking"
              className="focus-ring mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500">Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="focus-ring mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-slate-500">Day (optional)</label>
              <input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                placeholder="15"
                className="focus-ring mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Early booking logged so payment is accounted for"
              className="focus-ring mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
            />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Logging…" : "Log expense"}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

export default function ForwardSimulationClient({
  year,
  month,
  monthLabel,
  projectedInflow,
  committedBaseAndSips,
  advanceEntriesTotal,
  advanceEntriesCount,
  rows,
  categoryOptions,
}: {
  year: number;
  month: number;
  monthLabel: string;
  projectedInflow: number;
  committedBaseAndSips: number;
  advanceEntriesTotal: number;
  advanceEntriesCount: number;
  rows: CommitmentRow[];
  categoryOptions: MonthlyCategoryOptionDTO[];
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleResetToBase() {
    if (!window.confirm(`Reset ${monthLabel} back to the Monthly Base Plan? Any advance expenses you've logged here will be removed.`)) {
      return;
    }
    setResetting(true);
    const { ok, data } = await postJSON(`/api/monthly/tracking/${year}/${month}/reset`, {});
    setResetting(false);
    if (!ok) {
      window.alert(data.error ?? "Couldn't reset this month.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <ForwardSimulationPage
        monthLabel={monthLabel}
        projectedInflow={projectedInflow}
        committedBaseAndSips={committedBaseAndSips}
        advanceEntriesTotal={advanceEntriesTotal}
        advanceEntriesCount={advanceEntriesCount}
        rows={rows}
        onResetToBase={resetting ? undefined : handleResetToBase}
        onLogAdvanceExpense={() => setShowModal(true)}
      />
      {showModal && (
        <LogAdvanceExpenseModal
          year={year}
          month={month}
          categoryOptions={categoryOptions}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
