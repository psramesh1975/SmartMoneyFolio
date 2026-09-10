"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { CURRENCIES } from "@/lib/currencies";
import ImportExcelModal from "@/components/ImportExcelModal";
import type { ImportMode } from "@/lib/import/types";

type GoalRow = {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  targetDate: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [targetDate, setTargetDate] = useState("");

  function resetForm() {
    setEditingId(null);
    setName("");
    setTargetAmount("");
    setCurrentAmount("0");
    setCurrency("USD");
    setTargetDate("");
    setError(null);
  }

  function startEdit(g: GoalRow) {
    setEditingId(g.id);
    setName(g.name);
    setTargetAmount(g.targetAmount);
    setCurrentAmount(g.currentAmount);
    setCurrency(g.currency);
    setTargetDate(g.targetDate ? g.targetDate.slice(0, 10) : "");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !targetAmount) {
      setError("Give the goal a name and a target amount.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(editingId ? `/api/goals/${editingId}` : "/api/goals", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetAmount, currentAmount, currency, targetDate: targetDate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that goal.");
        return;
      }
      const updated: GoalRow = {
        id: editingId ?? data.goal.id,
        name,
        targetAmount,
        currentAmount,
        currency,
        targetDate: targetDate || null,
      };
      if (editingId) {
        setGoals((prev) => prev.map((g) => (g.id === editingId ? updated : g)));
      } else {
        setGoals((prev) => [...prev, updated]);
      }
      resetForm();
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (editingId === id) resetForm();
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="focus-ring bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 dark:bg-lime-400 dark:text-slate-900 dark:hover:bg-lime-300"
        >
          Import from Excel
        </button>
      </div>
      <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40 sm:grid-cols-2 lg:grid-cols-6"
        >
          <div className="sm:col-span-2 lg:col-span-6 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {editingId ? `Editing ${name || "goal"}` : "Add a new goal"}
            </p>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:underline dark:text-slate-400"
              >
                Cancel
              </button>
            )}
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Goal name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Retirement Corpus"
              className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Target amount</label>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="60000000"
              className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Current progress</label>
            <input
              type="number"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
              className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Target date (optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            />
          </div>
          <div className="flex items-end lg:col-span-6">
            <button
              type="submit"
              disabled={loading}
              className="focus-ring bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {loading ? "Saving…" : editingId ? "Save changes" : "Add goal"}
            </button>
          </div>
          {error && <p className="lg:col-span-6 text-sm text-amber-600 dark:text-amber-400">{error}</p>}
        </form>

      <div className="space-y-4">
        {goals.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">No goals added yet.</p>
        )}
        {goals.map((g) => {
          const target = Number(g.targetAmount) || 1;
          const current = Number(g.currentAmount) || 0;
          const pct = Math.min(100, Math.round((current / target) * 100));
          return (
            <div key={g.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-900 dark:text-white">{g.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {g.currency} {current.toLocaleString()} of {target.toLocaleString()} ({pct}%)
                  </span>
                  <button
                    onClick={() => startEdit(g)}
                    aria-label="Edit"
                    className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="text-xs text-amber-600 hover:underline dark:text-amber-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded bg-slate-50 dark:bg-white/5">
                <div className="h-full bg-blue-600 dark:bg-lime-400" style={{ width: `${pct}%` }} />
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
