"use client";

import { useState } from "react";
import type {
  MonthlyCategoryOptionDTO,
  MonthlyCategorySpendKindValue,
  MonthlyCategoryTypeValue,
} from "@/lib/monthly-types";
import { categoryBadgeTone } from "@/lib/monthly-badge";

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

  async function handleNameBlur(value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === category.name) return;
    const { ok, data } = await patchJSON(`/api/monthly/categories/${category.id}`, {
      name: trimmed,
    });
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
    <tr className="border-t border-slate-200/80 dark:border-slate-800">
      <td className="px-3 py-2">
        <input
          key={category.name}
          defaultValue={category.name}
          onBlur={(e) => handleNameBlur(e.target.value)}
          className="focus-ring w-full border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={category.type}
          onChange={(e) => handleTypeChange(e.target.value as MonthlyCategoryTypeValue)}
          className={`focus-ring rounded px-2 py-1 text-xs font-semibold ${categoryBadgeTone(category.type)}`}
        >
          <option value="INCOME">Income</option>
          <option value="OUTFLOW">Outflow</option>
        </select>
      </td>
      <td className="px-3 py-2">
        {category.type === "OUTFLOW" && (
          <select
            value={category.spendKind ?? "VARIABLE"}
            onChange={(e) => handleSpendKindChange(e.target.value as MonthlyCategorySpendKindValue)}
            className="focus-ring border border-slate-200/80 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
          >
            <option value="FIXED">Fixed</option>
            <option value="VARIABLE">Variable</option>
          </select>
        )}
      </td>
      <td className="px-3 py-2">
        {category.type === "OUTFLOW" && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={category.isSubscription}
              onChange={(e) => handleSubscriptionChange(e.target.checked)}
            />
            Subscription
          </label>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-rose-600 underline disabled:opacity-60 dark:text-rose-400"
        >
          {deleting ? "Removing…" : "Remove"}
        </button>
        {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </td>
    </tr>
  );
}

function AddCategoryRow({ onCreated }: { onCreated: (c: MonthlyCategoryOptionDTO) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<MonthlyCategoryTypeValue>("OUTFLOW");
  const [spendKind, setSpendKind] = useState<MonthlyCategorySpendKindValue>("VARIABLE");
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
    setSpendKind("VARIABLE");
    setIsSubscription(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-slate-200/80 px-3 py-3 dark:border-slate-800">
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Category name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subscriptions"
          className="focus-ring mt-1 w-48 border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as MonthlyCategoryTypeValue)}
          className="focus-ring mt-1 border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
        >
          <option value="INCOME">Income</option>
          <option value="OUTFLOW">Outflow</option>
        </select>
      </div>
      {type === "OUTFLOW" && (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Spend kind</label>
          <select
            value={spendKind}
            onChange={(e) => setSpendKind(e.target.value as MonthlyCategorySpendKindValue)}
            className="focus-ring mt-1 border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
          >
            <option value="FIXED">Fixed</option>
            <option value="VARIABLE">Variable</option>
          </select>
        </div>
      )}
      {type === "OUTFLOW" && (
        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={isSubscription}
            onChange={(e) => setIsSubscription(e.target.checked)}
          />
          Subscription
        </label>
      )}
      {error && <p className="w-full text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="focus-ring bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-lime-400 dark:text-slate-900 dark:hover:bg-lime-300"
      >
        {saving ? "Adding…" : "Add category"}
      </button>
    </form>
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
    <div className="border-t border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-white/5">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Manage Categories</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Rename a category or change its type here — this doesn't touch any line items using it.
        </p>
      </div>
      {categories.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="px-3 py-1 font-medium">Name</th>
              <th className="px-3 py-1 font-medium">Type</th>
              <th className="px-3 py-1 font-medium">Spend kind</th>
              <th className="px-3 py-1 font-medium">Subscription</th>
              <th className="px-3 py-1" />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} onUpdated={onCategoryUpdated} onDeleted={onCategoryDeleted} />
            ))}
          </tbody>
        </table>
      )}
      <AddCategoryRow onCreated={onCategoryCreated} />
    </div>
  );
}
