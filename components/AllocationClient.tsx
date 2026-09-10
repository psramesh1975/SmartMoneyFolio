"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImportExcelModal from "@/components/ImportExcelModal";

export default function AllocationClient({
  assetClasses,
  initialTargets,
}: {
  assetClasses: { value: string; label: string }[];
  initialTargets: Record<string, number>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    for (const c of assetClasses) v[c.value] = initialTargets[c.value] ?? 0;
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const rawTotal = Object.values(values).reduce((sum, v) => sum + (Number(v) || 0), 0);
  // Round for display and for the "is this 100%" check — imported targets
  // can carry decimal percentages, and floating-point summation of those
  // (e.g. 64.18 + 6.9 + 28.92) doesn't always land on exactly 100.
  const total = Math.round(rawTotal * 10) / 10;
  const isComplete = Math.abs(total - 100) < 0.05;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/allocation-targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: assetClasses.map((c) => ({
            assetClass: c.value,
            targetPercent: (Number(values[c.value]) || 0) / 100,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Couldn't save targets.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 max-w-lg">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="focus-ring bg-blue-600 px-4 py-2 text-base text-white hover:bg-blue-700 dark:bg-lime-400 dark:text-slate-900 dark:hover:bg-lime-300"
        >
          Import from Excel
        </button>
      </div>
      <div className="divide-y divide-slate-200/80 rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow dark:divide-slate-800 dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
        {assetClasses.map((c) => (
          <div key={c.value} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-base text-slate-900 dark:text-white">{c.label}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={values[c.value]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [c.value]: Number(e.target.value) }))
                }
                className="focus-ring w-16 border border-slate-200/80 bg-white px-2 py-1 text-right text-base text-slate-900 disabled:bg-slate-50 dark:border-slate-800 dark:bg-canvas-card dark:text-white dark:disabled:bg-white/5"
              />
              <span className="text-base text-slate-500 dark:text-slate-400">%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-base">
        <span className={isComplete ? "text-emerald-600 dark:text-cyan-400" : "text-amber-600 dark:text-amber-400"}>
          Total: {total}% {!isComplete && "(should add up to 100%)"}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="focus-ring bg-slate-900 px-4 py-2 text-base text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save targets"}
        </button>
      </div>
      {error && <p className="mt-2 text-base text-amber-600 dark:text-amber-400">{error}</p>}

      <ImportExcelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import targets from Excel"
        resourceLabelPlural="allocation targets"
        templateHref="/templates/targets-import-template.xlsx"
        validateUrl="/api/allocation-targets/import/validate"
        importUrl="/api/allocation-targets/import"
        hideModeChoice
        onImported={(result) => {
          const targets = (result as { targets: { assetClass: string; targetPercent: number }[] }).targets;
          setValues((prev) => {
            const next = { ...prev };
            for (const t of targets) next[t.assetClass] = Math.round(t.targetPercent * 1000) / 10;
            return next;
          });
          router.refresh();
        }}
      />
    </div>
  );
}
