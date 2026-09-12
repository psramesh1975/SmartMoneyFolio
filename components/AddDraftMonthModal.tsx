"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MONTH_LABELS, type Period } from "@/lib/monthly-periods";
import { MAX_DRAFT_MONTHS_AHEAD } from "@/lib/tracking-data";

// "Add Another Month" wasn't supplied as a file — FutureMonthsSection.tsx's
// setup notes just call for "the flow for the user to pick a new upcoming
// calendar month to initialize as a draft sheet". This is that flow: a
// month picker limited to the open, not-yet-initialized range beyond Next
// Month, capped the same way the server route caps it (MAX_DRAFT_MONTHS_AHEAD).
function addMonths(period: Period, n: number): Period {
  const total = (period.year * 12 + (period.month - 1)) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export default function AddDraftMonthModal({
  nextPeriod,
  existingDrafts,
  onClose,
}: {
  nextPeriod: Period;
  existingDrafts: { year: number; month: number }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const existingKeys = new Set(existingDrafts.map((d) => `${d.year}-${d.month}`));
  const candidates = Array.from({ length: MAX_DRAFT_MONTHS_AHEAD }, (_, i) => addMonths(nextPeriod, i + 1)).filter(
    (p) => !existingKeys.has(`${p.year}-${p.month}`)
  );

  const [selected, setSelected] = useState(candidates[0] ? `${candidates[0].year}-${candidates[0].month}` : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const [year, month] = selected.split("-").map(Number);
    setSaving(true);
    setError(null);
    const res = await fetch("/api/monthly/tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't add that month.");
      return;
    }
    const monthName = MONTH_LABELS[month - 1].toLowerCase();
    // Close before navigating: ClientSidebar (this modal's parent) lives in
    // the shared app layout and never unmounts on a route change within
    // (app), so without this the overlay would stay stuck open — full
    // z-50 screen-blocking — on top of whatever page the user lands on.
    onClose();
    router.push(`/tracking/${year}/${monthName}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-extrabold text-slate-900">Add Another Month</h3>
        <p className="mt-1 text-xs text-slate-500">
          Initializes a Forward Simulation draft, auto-populated from your Monthly Base Plan.
        </p>

        {candidates.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            Every upcoming month in range is already a draft.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="focus-ring w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
            >
              {candidates.map((p) => (
                <option key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
                  {MONTH_LABELS[p.month - 1]} {p.year}
                </option>
              ))}
            </select>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
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
                {saving ? "Adding…" : "Add month"}
              </button>
            </div>
          </form>
        )}

        {candidates.length === 0 && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
