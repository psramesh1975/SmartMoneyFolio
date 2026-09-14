"use client";

import { useState } from "react";

type UserRow = { id: string; email: string; status: string };

type HouseholdRow = {
  id: string;
  name: string;
  baseCurrency: string;
  city: string;
  subscriptionStatus: string;
  createdAt: string;
  isSuspended: boolean;
  familyMemberCount: number;
  accountCount: number;
  users: UserRow[];
};

const TIER_LABELS: Record<string, string> = { FREE: "Free", TRIAL: "Trial", PAID: "Paid" };

export default function PlatformClientsClient({
  initialHouseholds,
}: {
  initialHouseholds: HouseholdRow[];
}) {
  const [households, setHouseholds] = useState(initialHouseholds);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HouseholdRow | null>(null);

  async function toggleSuspend(householdId: string) {
    setBusyId(householdId);
    try {
      const res = await fetch(`/api/platform/clients/${householdId}/suspend`, { method: "PUT" });
      const data = await res.json();
      if (res.ok) {
        setHouseholds((prev) =>
          prev.map((h) => (h.id === householdId ? { ...h, isSuspended: data.isSuspended } : h))
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(householdId: string) {
    setBusyId(householdId);
    try {
      const res = await fetch(`/api/platform/clients/${householdId}`, { method: "DELETE" });
      if (res.ok) {
        setHouseholds((prev) => prev.filter((h) => h.id !== householdId));
        setDeleteTarget(null);
      }
    } finally {
      setBusyId(null);
    }
  }

  if (households.length === 0) {
    return <p className="mt-8 text-sm text-slate-400">No clients have signed up yet.</p>;
  }

  return (
    <>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800 bg-canvas-card">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-900/90 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3 pl-4">Household Name</th>
              <th className="p-3">Location</th>
              <th className="p-3">Plan Tier</th>
              <th className="p-3">Created</th>
              <th className="p-3 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {households.map((h) => (
              <tr key={h.id} className="transition hover:bg-slate-800/30">
                <td className="p-3 pl-4">
                  <span className="block font-bold text-white">
                    {h.name}
                    {h.isSuspended && (
                      <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                        Suspended
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {h.users[0]?.email ?? "—"}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {h.baseCurrency} · {h.familyMemberCount} member{h.familyMemberCount !== 1 ? "s" : ""} ·{" "}
                    {h.accountCount} holding{h.accountCount !== 1 ? "s" : ""}
                  </span>
                </td>
                <td className="p-3">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-teal-400">{h.city}</span>
                </td>
                <td className="p-3">
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-bold text-slate-300">
                    {TIER_LABELS[h.subscriptionStatus] ?? h.subscriptionStatus}
                  </span>
                </td>
                <td className="p-3 font-mono text-slate-400">
                  {new Date(h.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                </td>
                <td className="p-3 pr-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => toggleSuspend(h.id)}
                      disabled={busyId === h.id}
                      className={`focus-ring rounded border px-2.5 py-1 font-semibold disabled:opacity-60 ${
                        h.isSuspended
                          ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                          : "border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                      }`}
                    >
                      {h.isSuspended ? "Reactivate" : "Suspend"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(h)}
                      disabled={busyId === h.id}
                      className="focus-ring rounded border border-rose-500/40 px-2.5 py-1 font-semibold text-rose-400 hover:bg-rose-500/10 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          household={deleteTarget}
          busy={busyId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => confirmDelete(deleteTarget.id)}
        />
      )}
    </>
  );
}

function DeleteConfirmModal({
  household,
  busy,
  onCancel,
  onConfirm,
}: {
  household: HouseholdRow;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === household.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-canvas-card p-6 shadow-xl">
        <h2 className="text-base font-extrabold text-white">Permanently delete this household?</h2>
        <p className="mt-2 text-xs text-slate-400">
          This removes <strong className="text-white">{household.name}</strong> and every account, goal, liability,
          and monthly record attached to it. This cannot be undone.
        </p>
        <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Type the household name to confirm
        </label>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={household.name}
          className="focus-ring mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="focus-ring rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches || busy}
            className="focus-ring rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
