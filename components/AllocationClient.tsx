"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  const total = Object.values(values).reduce((sum, v) => sum + (Number(v) || 0), 0);

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
      <div className="divide-y divide-line border border-line bg-white">
        {assetClasses.map((c) => (
          <div key={c.value} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-base text-ink">{c.label}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={values[c.value]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [c.value]: Number(e.target.value) }))
                }
                className="focus-ring w-16 border border-line bg-white px-2 py-1 text-right text-base text-ink disabled:bg-paper-2"
              />
              <span className="text-base text-ink-2">%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-base">
        <span className={total === 100 ? "text-growth" : "text-amber"}>
          Total: {total}% {total !== 100 && "(should add up to 100%)"}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="focus-ring bg-ink px-4 py-2 text-base text-paper hover:bg-ink-2 disabled:opacity-60"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save targets"}
        </button>
      </div>
      {error && <p className="mt-2 text-base text-amber">{error}</p>}
    </div>
  );
}
