"use client";

import { useState } from "react";
import type {
  MonthlyCategoryOptionDTO,
  MonthlyCategorySpendKindValue,
  MonthlyCategoryTypeValue,
} from "@/lib/monthly-types";

// ─────────────────────────────────────────────────────────────────────────
// Matches the "Manage Categories" reference mockup (Category.html) exactly:
// 5-column table (Category Name / Direction / Behavior / Service Tag /
// Action) with the same 🟢🔴 pill badges and copy, plus the 4-column
// "Add a New Category" form below it.
//
// One departure, intentional: the mockup's demo data includes a third
// "🔵 Savings & Wealth" direction (its Mutual Fund SIP row). The schema only
// has two category types — INCOME and OUTFLOW — SIP contributions are
// auto-linked from Assets, not a manually-tagged category, so there's
// nothing on this page for a third direction to control. Only the two
// directions the schema actually supports are offered.
// ─────────────────────────────────────────────────────────────────────────

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function patchJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function DirectionBadge({
  type,
  onChange,
}: {
  type: MonthlyCategoryTypeValue;
  onChange: (type: MonthlyCategoryTypeValue) => void;
}) {
  const tone =
    type === "INCOME"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300";
  return (
    <select
      value={type}
      onChange={(e) => onChange(e.target.value as MonthlyCategoryTypeValue)}
      className={`rounded px-2.5 py-0.5 text-[11px] font-bold focus:outline-2 focus:outline-[var(--table-primary)] ${tone}`}
    >
      <option value="INCOME">🟢 Money In (Inflow)</option>
      <option value="OUTFLOW">🔴 Money Out (Expense)</option>
    </select>
  );
}

function CategoryRow({
  category,
  onUpdated,
  onDeleted,
}: {
  category: MonthlyCategoryOptionDTO;
  onUpdated: (category: MonthlyCategoryOptionDTO) => void;
  onDeleted: (id: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isOutflow = category.type === "OUTFLOW";

  async function handleNameBlur(value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === category.name) return;
    const { ok, data } = await patchJSON(`/api/monthly/categories/${category.id}`, { name: trimmed });
    if (ok) {
      setError(null);
      onUpdated({ ...category, name: trimmed });
    } else {
      setError(data.error ?? "Couldn't save that.");
    }
  }

  async function handleTypeChange(type: MonthlyCategoryTypeValue) {
    const { ok, data } = await patchJSON(`/api/monthly/categories/${category.id}`, { type });
    if (ok) {
      setError(null);
      onUpdated({ ...category, type });
    } else {
      setError(data.error ?? "Couldn't save that.");
    }
  }

  async function handleSpendKindChange(spendKind: MonthlyCategorySpendKindValue) {
    const { ok, data } = await patchJSON(`/api/monthly/categories/${category.id}`, { spendKind });
    if (ok) {
      setError(null);
      onUpdated({ ...category, spendKind });
    } else {
      setError(data.error ?? "Couldn't save that.");
    }
  }

  async function handleSubscriptionChange(isSubscription: boolean) {
    const { ok, data } = await patchJSON(`/api/monthly/categories/${category.id}`, { isSubscription });
    if (ok) {
      setError(null);
      onUpdated({ ...category, isSubscription });
    } else {
      setError(data.error ?? "Couldn't save that.");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/monthly/categories/${category.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      onDeleted(category.id);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Couldn't delete that.");
  }

  return (
    <tr
      className={`transition hover:bg-slate-50/70 dark:hover:bg-white/5 ${
        category.type === "INCOME" ? "bg-emerald-50/20 dark:bg-emerald-400/5" : ""
      }`}
    >
      <td className="px-5 py-3">
        <input
          key={category.name}
          defaultValue={category.name}
          onBlur={(e) => handleNameBlur(e.target.value)}
          className="w-full rounded-md border-0 bg-transparent px-1 py-1 text-sm font-bold text-slate-900 focus:outline-2 focus:outline-[var(--table-primary)] dark:text-white"
        />
      </td>
      <td className="px-4 py-3">
        <DirectionBadge type={category.type} onChange={handleTypeChange} />
      </td>
      <td className="px-4 py-3">
        {isOutflow ? (
          <select
            value={category.spendKind ?? "VARIABLE"}
            onChange={(e) => handleSpendKindChange(e.target.value as MonthlyCategorySpendKindValue)}
            className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 focus:outline-2 focus:outline-[var(--table-primary)] dark:border-slate-700 dark:bg-canvas-card dark:text-slate-300"
          >
            <option value="FIXED">🔒 Fixed (Same amount)</option>
            <option value="VARIABLE">🔁 Variable</option>
          </select>
        ) : (
          <span className="italic text-slate-400 dark:text-slate-500">— Regular Inflow</span>
        )}
      </td>
      <td className="px-4 py-3">
        {isOutflow ? (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={category.isSubscription}
              onChange={(e) => handleSubscriptionChange(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            {category.isSubscription ? (
              <span className="font-bold text-indigo-700 dark:text-lime-400">Sub ⚡ (Active)</span>
            ) : (
              <span>—</span>
            )}
          </label>
        ) : (
          <span className="italic text-slate-400 dark:text-slate-500">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="font-bold text-rose-600 hover:underline disabled:opacity-60 dark:text-rose-400"
        >
          {deleting ? "Removing…" : "Remove"}
        </button>
        {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </td>
    </tr>
  );
}

function AddCategoryForm({ onCreated }: { onCreated: (c: MonthlyCategoryOptionDTO) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<MonthlyCategoryTypeValue>("OUTFLOW");
  const [spendKind, setSpendKind] = useState<MonthlyCategorySpendKindValue>("FIXED");
  const [isSubscription, setIsSubscription] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name the category.");
      return;
    }
    setSaving(true);
    setError(null);
    const { ok, data } = await postJSON("/api/monthly/categories", {
      name: name.trim(),
      type,
      spendKind: type === "OUTFLOW" ? spendKind : null,
      isSubscription: type === "OUTFLOW" ? isSubscription : false,
    });
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Couldn't add that.");
      return;
    }
    onCreated({
      id: data.category.id,
      name: name.trim(),
      type,
      spendKind: type === "OUTFLOW" ? spendKind : null,
      isSubscription: type === "OUTFLOW" ? isSubscription : false,
    });
    setName("");
    setSpendKind("FIXED");
    setIsSubscription(false);
  }

  return (
    <div className="border-t-2 bg-slate-50 p-5 dark:border-slate-800 dark:bg-white/5" style={{ borderColor: "var(--table-border)" }}>
      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
        Add a New Category
      </h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">Category Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., PPF Deposit"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:outline-2 focus:outline-[var(--table-primary)] dark:border-slate-700 dark:bg-canvas-card dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">Direction (Type)</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MonthlyCategoryTypeValue)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold focus:outline-2 focus:outline-[var(--table-primary)] dark:border-slate-700 dark:bg-canvas-card dark:text-white"
          >
            <option value="OUTFLOW">🔴 Money Out (Expense)</option>
            <option value="INCOME">🟢 Money In (Inflow)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 items-center gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">Behavior</label>
            <select
              value={spendKind}
              onChange={(e) => setSpendKind(e.target.value as MonthlyCategorySpendKindValue)}
              disabled={type !== "OUTFLOW"}
              className="w-full rounded-xl border border-slate-300 px-2 py-2 text-xs font-semibold disabled:opacity-50 focus:outline-2 focus:outline-[var(--table-primary)] dark:border-slate-700 dark:bg-canvas-card dark:text-white"
            >
              <option value="FIXED">Fixed</option>
              <option value="VARIABLE">Variable</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 pt-5">
            <input
              type="checkbox"
              id="cat-sub-input"
              checked={isSubscription}
              disabled={type !== "OUTFLOW"}
              onChange={(e) => setIsSubscription(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <label htmlFor="cat-sub-input" className="cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
              Sub?
            </label>
          </div>
        </div>
        <div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-60"
            style={{ backgroundColor: "var(--table-primary)" }}
          >
            {saving ? "Adding…" : "+ Add Category"}
          </button>
        </div>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400 sm:col-span-4">{error}</p>}
      </form>
    </div>
  );
}

export default function ManageCategoriesPanel({
  categories,
  onCategoryUpdated,
  onCategoryCreated,
  onCategoryDeleted,
}: {
  categories: MonthlyCategoryOptionDTO[];
  onCategoryUpdated: (category: MonthlyCategoryOptionDTO) => void;
  onCategoryCreated: (category: MonthlyCategoryOptionDTO) => void;
  onCategoryDeleted: (id: string) => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border-2 bg-white shadow-sm dark:bg-canvas-card"
      style={{ borderColor: "var(--table-border)" }}
    >
      <div className="flex flex-col justify-between gap-2 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Manage Categories</h2>
            <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-white/10 dark:text-slate-300">
              Blueprint Settings
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Configure standard classification tags. Direction automatically assigns items to Inflow or Expense
            tables.
          </p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-white/5 dark:text-slate-400">
              <tr>
                <th className="w-1/4 px-5 py-3">Category Name</th>
                <th className="px-4 py-3">Direction (Target Table)</th>
                <th className="px-4 py-3">Behavior (Spend Kind)</th>
                <th className="px-4 py-3">Service Tag</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800">
              {categories.map((c) => (
                <CategoryRow key={c.id} category={c} onUpdated={onCategoryUpdated} onDeleted={onCategoryDeleted} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddCategoryForm onCreated={onCategoryCreated} />
    </div>
  );
}
