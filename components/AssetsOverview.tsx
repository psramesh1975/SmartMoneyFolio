"use client";

import { useState } from "react";
import { ASSET_GROUPS, assetClassLabel } from "@/lib/asset-classes";

type AccountRow = {
  id: string;
  familyMemberId: string;
  familyMemberName: string;
  assetClass: string;
  holdingName: string;
  currency: string;
  currentValue: string;
};

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

// Groups accounts by ASSET_GROUPS into collapsible sections, same +/- pattern
// as the "Monthly Tracking" sidebar group, with a client-side entity filter.
// No new API call — accounts are already fetched household-wide by the page.
export default function AssetsOverview({
  accounts,
  familyMembers,
  baseCurrency,
}: {
  accounts: AccountRow[];
  familyMembers: { id: string; name: string }[];
  baseCurrency: string;
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered =
    selectedMemberId === "all" ? accounts : accounts.filter((a) => a.familyMemberId === selectedMemberId);

  function toggleGroup(label: string) {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedMemberId("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            selectedMemberId === "all"
              ? "bg-blue-600 text-white dark:bg-lime-400 dark:text-slate-900"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
          }`}
        >
          All
        </button>
        {familyMembers.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedMemberId(m.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selectedMemberId === m.id
                ? "bg-blue-600 text-white dark:bg-lime-400 dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {ASSET_GROUPS.map((group) => {
          const rows = filtered.filter((a) => (group.classes as string[]).includes(a.assetClass));
          if (rows.length === 0) return null;
          const isOpen = !!expanded[group.label];
          const groupTotal = rows
            .filter((r) => r.currency === baseCurrency)
            .reduce((sum, r) => sum + Number(r.currentValue), 0);

          return (
            <div
              key={group.label}
              className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="focus-ring flex w-full items-center justify-between px-4 py-3 text-left"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 text-center text-slate-500 dark:text-slate-400">{isOpen ? "–" : "+"}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{group.label}</span>
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {baseCurrency} {fmt(groupTotal)}
                </span>
              </button>

              {isOpen && (
                <table className="w-full border-t border-slate-200/80 text-xs dark:border-slate-800">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800/60">
                        <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{r.familyMemberName}</td>
                        <td className="px-2 py-2 text-slate-900 dark:text-white">{r.holdingName}</td>
                        <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{assetClassLabel(r.assetClass)}</td>
                        <td className="px-4 py-2 text-right text-slate-900 dark:text-white">
                          {r.currency} {fmt(Number(r.currentValue))}
                          {r.currency !== baseCurrency && (
                            <span className="ml-1 text-slate-400 dark:text-slate-500">(not counted)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
