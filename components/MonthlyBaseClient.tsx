"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MonthlyBaseCategoryDTO, MonthlyLineItemDTO } from "@/lib/monthly-types";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

function repeatLabel(months: number[]) {
  if (months.length === 0) return "Every month";
  return months.map((m) => MONTH_SHORT[m - 1]).join(", ");
}

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

function MonthPicker({
  everyMonth,
  setEveryMonth,
  months,
  toggleMonth,
}: {
  everyMonth: boolean;
  setEveryMonth: (v: boolean) => void;
  months: number[];
  toggleMonth: (m: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={everyMonth} onChange={(e) => setEveryMonth(e.target.checked)} />
        Every month
      </label>
      {!everyMonth && (
        <div className="flex flex-wrap gap-1">
          {MONTH_SHORT.map((label, i) => {
            const m = i + 1;
            const selected = months.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMonth(m)}
                className={`focus-ring px-2 py-1 text-xs ${
                  selected ? "bg-ink text-paper" : "border border-line bg-white text-ink-2"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditLineItemRow({
  lineItem,
  currency,
  onUpdated,
}: {
  lineItem: MonthlyLineItemDTO;
  currency: string;
  onUpdated: (lineItem: MonthlyLineItemDTO) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lineItem.name);
  const [baseAmount, setBaseAmount] = useState(lineItem.baseAmount);
  const [everyMonth, setEveryMonth] = useState(lineItem.repeatMonths.length === 0);
  const [months, setMonths] = useState<number[]>(lineItem.repeatMonths);
  const [active, setActive] = useState(lineItem.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMonth(m: number) {
    setMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)));
  }

  async function handleSave() {
    if (!name.trim() || !baseAmount) {
      setError("Give it a name and a base amount.");
      return;
    }
    setSaving(true);
    setError(null);
    const { ok, data } = await patchJSON(`/api/monthly/line-items/${lineItem.id}`, {
      name,
      baseAmount: Number(baseAmount),
      repeatMonths: everyMonth ? [] : months,
      isActive: active,
    });
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Couldn't save that.");
      return;
    }
    onUpdated({
      ...lineItem,
      name,
      baseAmount: String(baseAmount),
      repeatMonths: everyMonth ? [] : months,
      isActive: active,
    });
    setEditing(false);
  }

  if (!editing) {
    return (
      <tr className={`border-t border-line ${lineItem.isActive ? "text-ink" : "text-ink-2"}`}>
        <td className="py-2 pr-2">
          {lineItem.name}
          {!lineItem.isActive && <span className="ml-2 text-xs text-coral">(stopped)</span>}
        </td>
        <td className="py-2 pr-2 text-right whitespace-nowrap">
          {currency} {fmt(Number(lineItem.baseAmount))}
        </td>
        <td className="py-2 pr-2 text-sm text-ink-2">{repeatLabel(lineItem.repeatMonths)}</td>
        <td className="py-2 text-right">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-folio underline decoration-dotted"
          >
            Edit
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line bg-paper-2">
      <td colSpan={4} className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-2">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="focus-ring mt-1 w-48 border border-line bg-white px-2 py-1 text-sm text-ink"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2">Base amount</label>
            <input
              type="number"
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              className="focus-ring mt-1 w-32 border border-line bg-white px-2 py-1 text-sm text-ink"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} />
            Stop this recurring line
          </label>
        </div>
        <div className="mt-2">
          <MonthPicker everyMonth={everyMonth} setEveryMonth={setEveryMonth} months={months} toggleMonth={toggleMonth} />
        </div>
        {error && <p className="mt-2 text-xs text-coral">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="focus-ring bg-ink px-3 py-1 text-xs text-paper hover:bg-ink-2 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="focus-ring border border-line bg-white px-3 py-1 text-xs text-ink-2"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddLineItemForm({
  categoryId,
  onCreated,
  onCancel,
}: {
  categoryId: string;
  onCreated: (lineItem: MonthlyLineItemDTO) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [everyMonth, setEveryMonth] = useState(true);
  const [months, setMonths] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMonth(m: number) {
    setMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !baseAmount) {
      setError("Give it a name and a base amount.");
      return;
    }
    setSaving(true);
    setError(null);
    const repeatMonths = everyMonth ? [] : months;
    const { ok, data } = await postJSON("/api/monthly/line-items", {
      categoryId,
      name,
      baseAmount: Number(baseAmount),
      repeatMonths,
    });
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Couldn't add that.");
      return;
    }
    onCreated({
      id: data.lineItem.id,
      categoryId,
      name,
      baseAmount: String(baseAmount),
      repeatMonths,
      isActive: true,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 border border-line bg-paper-2 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-2">Line name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Home Loan EMI"
            className="focus-ring mt-1 w-48 border border-line bg-white px-2 py-1 text-sm text-ink"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-2">Base amount</label>
          <input
            type="number"
            value={baseAmount}
            onChange={(e) => setBaseAmount(e.target.value)}
            className="focus-ring mt-1 w-32 border border-line bg-white px-2 py-1 text-sm text-ink"
          />
        </div>
      </div>
      <MonthPicker everyMonth={everyMonth} setEveryMonth={setEveryMonth} months={months} toggleMonth={toggleMonth} />
      {error && <p className="text-xs text-coral">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="focus-ring bg-folio px-3 py-1 text-xs text-paper hover:bg-folio-light disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add line item"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring border border-line bg-white px-3 py-1 text-xs text-ink-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function CategoryCard({
  category,
  currency,
  onLineItemAdded,
  onLineItemUpdated,
}: {
  category: MonthlyBaseCategoryDTO;
  currency: string;
  onLineItemAdded: (categoryId: string, lineItem: MonthlyLineItemDTO) => void;
  onLineItemUpdated: (categoryId: string, lineItem: MonthlyLineItemDTO) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-left"
        >
          <span className="text-ink-2">{expanded ? "▾" : "▸"}</span>
          <h3 className="font-display text-lg text-ink">{category.name}</h3>
          <span className="text-xs font-normal uppercase tracking-wide text-ink-2">
            {category.type === "INCOME" ? "Income" : "Outflow"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          className="text-xs text-folio underline decoration-dotted"
        >
          + Add line item
        </button>
      </div>

      {expanded && (
        <>
          {category.lineItems.length === 0 ? (
            <p className="mt-3 text-sm text-ink-2">Nothing set up yet.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-ink-2">
                  <th className="pb-1 font-medium">Line</th>
                  <th className="pb-1 text-right font-medium">Base amount</th>
                  <th className="pb-1 font-medium">Repeats</th>
                  <th className="pb-1" />
                </tr>
              </thead>
              <tbody>
                {category.lineItems.map((li) => (
                  <EditLineItemRow
                    key={li.id}
                    lineItem={li}
                    currency={currency}
                    onUpdated={(updated) => onLineItemUpdated(category.id, updated)}
                  />
                ))}
              </tbody>
            </table>
          )}

          {showAdd && (
            <AddLineItemForm
              categoryId={category.id}
              onCreated={(li) => {
                setShowAdd(false);
                onLineItemAdded(category.id, li);
              }}
              onCancel={() => setShowAdd(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

function AddCategoryForm({
  onCreated,
  onCancel,
}: {
  onCreated: (category: MonthlyBaseCategoryDTO) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"INCOME" | "OUTFLOW">("OUTFLOW");
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
    const { ok, data } = await postJSON("/api/monthly/categories", { name, type });
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Couldn't add that.");
      return;
    }
    onCreated({ id: data.category.id, name, type, sortOrder: data.category.sortOrder, lineItems: [] });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border border-line bg-paper-2 p-4">
      <div>
        <label className="block text-xs font-medium text-ink-2">Category name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subscriptions"
          className="focus-ring mt-1 w-48 border border-line bg-white px-2 py-1 text-sm text-ink"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-2">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "INCOME" | "OUTFLOW")}
          className="focus-ring mt-1 border border-line bg-white px-2 py-1 text-sm text-ink"
        >
          <option value="INCOME">Income</option>
          <option value="OUTFLOW">Outflow</option>
        </select>
      </div>
      {error && <p className="w-full text-xs text-coral">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="focus-ring bg-ink px-3 py-1 text-xs text-paper hover:bg-ink-2 disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add category"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring border border-line bg-white px-3 py-1 text-xs text-ink-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function MonthlyBaseClient({
  initialCategories,
  currency,
}: {
  initialCategories: MonthlyBaseCategoryDTO[];
  currency: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<MonthlyBaseCategoryDTO[]>(initialCategories);
  const [showAddCategory, setShowAddCategory] = useState(false);

  function handleLineItemAdded(categoryId: string, lineItem: MonthlyLineItemDTO) {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, lineItems: [...c.lineItems, lineItem] } : c))
    );
    router.refresh();
  }

  function handleLineItemUpdated(categoryId: string, lineItem: MonthlyLineItemDTO) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? { ...c, lineItems: c.lineItems.map((li) => (li.id === lineItem.id ? lineItem : li)) }
          : c
      )
    );
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-4">
      {categories.length === 0 && (
        <p className="text-base text-ink-2">No categories yet — add one to get started.</p>
      )}
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          currency={currency}
          onLineItemAdded={handleLineItemAdded}
          onLineItemUpdated={handleLineItemUpdated}
        />
      ))}

      {showAddCategory ? (
        <AddCategoryForm
          onCreated={(category) => {
            setCategories((prev) => [...prev, category]);
            setShowAddCategory(false);
            router.refresh();
          }}
          onCancel={() => setShowAddCategory(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddCategory(true)}
          className="focus-ring bg-ink px-4 py-2 text-base text-paper hover:bg-ink-2"
        >
          + Add category
        </button>
      )}
    </div>
  );
}
