"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MonthlyBaseCategoryDTO, MonthlyLineItemDTO } from "@/lib/monthly-types";
import MonthlySheetTable, { type SheetRow } from "@/components/MonthlySheetTable";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

// Repeat months / stop / rename don't fit the sheet's fixed column set, so
// they live in a small panel below the table instead, opened via the
// "Edit" action riding along with the row's name cell.
function EditLineItemPanel({
  lineItem,
  onSaved,
  onCancel,
}: {
  lineItem: MonthlyLineItemDTO;
  onSaved: (lineItem: MonthlyLineItemDTO) => void;
  onCancel: () => void;
}) {
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
    onSaved({
      ...lineItem,
      name,
      baseAmount: String(baseAmount),
      repeatMonths: everyMonth ? [] : months,
      isActive: active,
    });
  }

  return (
    <div className="border border-line bg-paper-2 p-3">
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
          onClick={onCancel}
          className="focus-ring border border-line bg-white px-3 py-1 text-xs text-ink-2"
        >
          Cancel
        </button>
      </div>
    </div>
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
      notes: null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border border-line bg-paper-2 p-3">
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
  onLineItemAdded,
  onLineItemUpdated,
}: {
  category: MonthlyBaseCategoryDTO;
  onLineItemAdded: (categoryId: string, lineItem: MonthlyLineItemDTO) => void;
  onLineItemUpdated: (categoryId: string, lineItem: MonthlyLineItemDTO) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingItem = category.lineItems.find((li) => li.id === editingId) ?? null;

  async function handleCellChange(rowId: string, field: string, value: string | boolean) {
    const lineItem = category.lineItems.find((li) => li.id === rowId);
    if (!lineItem) return;
    if (field === "base") {
      const raw = String(value).trim();
      if (raw === "") return;
      const { ok, data } = await patchJSON(`/api/monthly/line-items/${rowId}`, { baseAmount: Number(raw) });
      if (!ok) return;
      onLineItemUpdated(category.id, { ...lineItem, baseAmount: raw });
    } else if (field === "remark") {
      const raw = String(value);
      const { ok } = await patchJSON(`/api/monthly/line-items/${rowId}`, { notes: raw === "" ? null : raw });
      if (!ok) return;
      onLineItemUpdated(category.id, { ...lineItem, notes: raw === "" ? null : raw });
    }
    // planned/actual/isSkipped aren't applicable to line items — no column for them here.
  }

  const rows: SheetRow[] = category.lineItems.map((li) => ({
    id: li.id,
    name: li.isActive ? li.name : `${li.name} (stopped)`,
    base: Number(li.baseAmount),
    planned: null,
    actual: null,
    remark: li.notes,
    actions: (
      <button
        type="button"
        onClick={() => setEditingId((cur) => (cur === li.id ? null : li.id))}
        className="text-xs text-folio underline decoration-dotted"
      >
        Edit
      </button>
    ),
  }));

  return (
    <div className="mt-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
        {category.type === "INCOME" ? "Income" : "Outflow"}
      </p>
      <MonthlySheetTable
        categoryName={category.name}
        rows={rows}
        enabledColumns={["base"]}
        showSkipColumn={false}
        onCellChange={handleCellChange}
        footerSlot={
          showAdd ? (
            <AddLineItemForm
              categoryId={category.id}
              onCreated={(li) => {
                setShowAdd(false);
                onLineItemAdded(category.id, li);
              }}
              onCancel={() => setShowAdd(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-xs text-folio underline decoration-dotted"
            >
              + Add line item
            </button>
          )
        }
      />
      {editingItem && (
        <div className="mt-2">
          <EditLineItemPanel
            lineItem={editingItem}
            onSaved={(li) => {
              onLineItemUpdated(category.id, li);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        </div>
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
}: {
  initialCategories: MonthlyBaseCategoryDTO[];
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
    <div className="mt-8">
      {categories.length === 0 && (
        <p className="text-base text-ink-2">No categories yet — add one to get started.</p>
      )}
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          onLineItemAdded={handleLineItemAdded}
          onLineItemUpdated={handleLineItemUpdated}
        />
      ))}

      <div className="mt-8">
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
    </div>
  );
}
