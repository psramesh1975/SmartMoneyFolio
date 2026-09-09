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
    return <p className="mt-8 text-base text-ink-2">No clients have signed up yet.</p>;
  }

  return (
    <div className="mt-8 space-y-4">
      {households.map((h) => (
        <div key={h.id} className="border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-medium text-ink">
                {h.name}
                {h.isSuspended && (
                  <span className="ml-2 text-xs font-semibold uppercase text-amber">Suspended</span>
                )}
              </p>
              <p className="text-sm text-ink-2">
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
                  ? "border-growth text-growth hover:bg-growth/5"
                  : "border-amber text-amber hover:bg-amber/5"
              }`}
            >
              {h.isSuspended ? "Reactivate" : "Suspend"}
            </button>
          </div>

          <div className="mt-3 divide-y divide-line border-t border-line pt-2">
            {h.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-1.5 text-base">
                <span className="text-ink">{u.email}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
