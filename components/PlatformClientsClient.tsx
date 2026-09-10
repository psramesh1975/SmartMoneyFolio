"use client";

import { useState } from "react";

type UserRow = { id: string; email: string; status: string };

type HouseholdRow = {
  id: string;
  name: string;
  baseCurrency: string;
  createdAt: string;
  isSuspended: boolean;
  familyMemberCount: number;
  accountCount: number;
  users: UserRow[];
};

export default function PlatformClientsClient({
  initialHouseholds,
}: {
  initialHouseholds: HouseholdRow[];
}) {
  const [households, setHouseholds] = useState(initialHouseholds);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  if (households.length === 0) {
    return <p className="mt-8 text-base text-slate-500 dark:text-slate-400">No clients have signed up yet.</p>;
  }

  return (
    <div className="mt-8 space-y-4">
      {households.map((h) => (
        <div key={h.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-medium text-slate-900 dark:text-white">
                {h.name}
                {h.isSuspended && (
                  <span className="ml-2 text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">Suspended</span>
                )}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {h.baseCurrency} · {h.familyMemberCount} family member
                {h.familyMemberCount !== 1 ? "s" : ""} · {h.accountCount} holding
                {h.accountCount !== 1 ? "s" : ""} · joined{" "}
                {new Date(h.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => toggleSuspend(h.id)}
              disabled={busyId === h.id}
              className={`focus-ring border px-3 py-1.5 text-xs disabled:opacity-60 ${
                h.isSuspended
                  ? "border-emerald-600 text-emerald-600 hover:bg-emerald-600/5 dark:border-cyan-400 dark:text-cyan-400 dark:hover:bg-cyan-400/5"
                  : "border-amber-600 text-amber-600 hover:bg-amber-600/5 dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-400/5"
              }`}
            >
              {h.isSuspended ? "Reactivate" : "Suspend"}
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-200/80 border-t border-slate-200/80 pt-2 dark:divide-slate-800 dark:border-slate-800">
            {h.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-1.5 text-base">
                <span className="text-slate-900 dark:text-white">{u.email}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
