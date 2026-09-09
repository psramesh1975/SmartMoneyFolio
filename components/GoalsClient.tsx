"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/currencies";
import ImportExcelModal from "@/components/ImportExcelModal";
import type { ImportMode } from "@/lib/import/types";

type GoalRow = {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
};

export default function GoalsClient({
  initialGoals,
}: {
  initialGoals: GoalRow[];
}) {
  const router = useRouter();
  const [goals, setGoals] = useState(initialGoals);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [currency, setCurrency] = useState("USD");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !targetAmount) {
      setError("Give the goal a name and a target amount.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetAmount, currentAmount, currency }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't add that goal.");
        return;
      }
      setGoals((prev) => [
        ...prev,
        { id: data.goal.id, name, targetAmount, currentAmount, currency },
      ]);
      setName("");
      setTargetAmount("");
      setCurrentAmount("0");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="focus-ring bg-folio px-4 py-2 text-base text-paper hover:bg-folio-light"
        >
          Import from Excel
        </button>
      </div>
      <form
          onSubmit={handleAdd}
          className="grid grid-cols-1 gap-3 border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-ink-2">Goal name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Retirement Corpus"
              className="focus-ring mt-1 w-full border border-line bg-white px-2 py-2 text-base text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="focus-ring mt-1 w-full border border-line bg-white px-2 py-2 text-base text-ink"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2">Target amount</label>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="60000000"
              className="focus-ring mt-1 w-full border border-line bg-white px-2 py-2 text-base text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2">Current progress</label>
            <input
              type="number"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
              className="focus-ring mt-1 w-full border border-line bg-white px-2 py-2 text-base text-ink"
            />
          </div>
          <div className="flex items-end lg:col-span-5">
            <button
              type="submit"
              disabled={loading}
              className="focus-ring bg-ink px-4 py-2 text-base text-paper hover:bg-ink-2 disabled:opacity-60"
            >
              {loading ? "Adding…" : "Add goal"}
            </button>
          </div>
          {error && <p className="lg:col-span-5 text-base text-amber">{error}</p>}
        </form>

      <div className="space-y-4">
        {goals.length === 0 && (
          <p className="text-base text-ink-2">No goals added yet.</p>
        )}
        {goals.map((g) => {
          const target = Number(g.targetAmount) || 1;
          const current = Number(g.currentAmount) || 0;
          const pct = Math.min(100, Math.round((current / target) * 100));
          return (
            <div key={g.id} className="border border-line bg-white p-4">
              <div className="flex items-center justify-between text-base">
                <span className="font-medium text-ink">{g.name}</span>
                <span className="text-ink-2">
                  {g.currency} {current.toLocaleString()} of {target.toLocaleString()} ({pct}%)
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded bg-paper-2">
                <div className="h-full bg-folio" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <ImportExcelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import goals from Excel"
        resourceLabelPlural="goals"
        templateHref="/templates/goals-import-template.xlsx"
        validateUrl="/api/goals/import/validate"
        importUrl="/api/goals/import"
        onImported={(result, mode: ImportMode) => {
          const items = (result as { items: typeof goals }).items;
          setGoals((prev) => (mode === "replace" ? items : [...prev, ...items]));
          router.refresh();
        }}
      />
    </div>
  );
}
