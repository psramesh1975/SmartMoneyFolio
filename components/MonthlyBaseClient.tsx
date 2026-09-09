"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MonthlyBaseRowDTO, MonthlyCategoryOptionDTO } from "@/lib/monthly-types";
import CategoryCombobox from "@/components/CategoryCombobox";
import ManageCategoriesPanel from "@/components/ManageCategoriesPanel";

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

// Matches the mockup's formatNumber(): "-" for zero, otherwise a fixed
// 2-decimal, comma-grouped figure.
function formatTotal(n: number) {
  if (n === 0) return "-";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Row = {
  id: string; // real MonthlyLineItem id once persisted, otherwise a local temp id
  name: string;
  categoryId: string | null;
  baseAmount: string;
  persisted: boolean;
};

function makeTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function MonthlyBaseClient({
  initialLineItems,
  initialCategories,
}: {
  initialLineItems: MonthlyBaseRowDTO[];
  initialCategories: MonthlyCategoryOptionDTO[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<MonthlyCategoryOptionDTO[]>(initialCategories);
  const [rows, setRows] = useState<Row[]>(
    initialLineItems.map((li) => ({
      id: li.id,
      name: li.name,
      categoryId: li.categoryId,
      baseAmount: li.baseAmount,
      persisted: true,
    }))
  );
  const [showManageCategories, setShowManageCategories] = useState(false);
  const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const total = rows.reduce((sum, r) => sum + (Number(r.baseAmount) || 0), 0);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function rebindRef(oldId: string, newId: string) {
    nameInputRefs.current[newId] = nameInputRefs.current[oldId];
    delete nameInputRefs.current[oldId];
  }

  function handleAddRow() {
    const tempId = makeTempId();
    setRows((prev) => [
      ...prev,
      {
        id: tempId,
        name: "",
        categoryId: categories[0]?.id ?? null,
        baseAmount: "0.00",
        persisted: false,
      },
    ]);
    requestAnimationFrame(() => nameInputRefs.current[tempId]?.focus());
  }

  // Not created server-side until the user actually types a name (and a
  // category is available) — a click on "+ Add Line Item" alone never hits
  // the API.
  async function createRow(row: Row, overrides: Partial<Pick<Row, "name" | "categoryId" | "baseAmount">>) {
    const name = (overrides.name ?? row.name).trim();
    const categoryId = overrides.categoryId ?? row.categoryId;
    const baseAmount = overrides.baseAmount ?? row.baseAmount;
    if (!name || !categoryId) return;
    const { ok, data } = await postJSON("/api/monthly/line-items", {
      categoryId,
      name,
      baseAmount: Number(baseAmount) || 0,
    });
    if (!ok) return;
    const newId = data.lineItem.id;
    rebindRef(row.id, newId);
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, id: newId, name, categoryId, baseAmount, persisted: true }
          : r
      )
    );
    router.refresh();
  }

  async function handleNameBlur(rowId: string, value: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const trimmed = value.trim();

    if (row.persisted) {
      if (trimmed && trimmed !== row.name) {
        const { ok } = await patchJSON(`/api/monthly/line-items/${rowId}`, { name: trimmed });
        if (ok) updateRow(rowId, { name: trimmed });
      }
      return;
    }

    if (!trimmed) return; // still blank — nothing to create yet
    if (!row.categoryId) {
      updateRow(rowId, { name: trimmed }); // keep it for once a category exists
      return;
    }
    await createRow(row, { name: trimmed });
  }

  async function handleCategoryChange(rowId: string, categoryId: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    updateRow(rowId, { categoryId });

    if (row.persisted) {
      await patchJSON(`/api/monthly/line-items/${rowId}`, { categoryId });
    } else if (row.name.trim()) {
      await createRow(row, { categoryId });
    }
  }

  function handleBaseChange(rowId: string, value: string) {
    updateRow(rowId, { baseAmount: value });
  }

  async function handleBaseBlur(rowId: string, value: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    if (row.persisted) {
      await patchJSON(`/api/monthly/line-items/${rowId}`, { baseAmount: Number(value) || 0 });
    } else if (row.name.trim() && row.categoryId) {
      await createRow(row, { baseAmount: value });
    }
  }

  async function handleDelete(rowId: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    delete nameInputRefs.current[rowId];
    if (row.persisted) {
      // Soft-stop, not a hard delete — history already generated in past
      // months keeps its lineItemId.
      await patchJSON(`/api/monthly/line-items/${rowId}`, { isActive: false });
      router.refresh();
    }
  }

  // Shared by the row-level CategoryCombobox (creating inline while typing)
  // and the Manage Categories panel's own "+ Add category" form — either
  // path just appends to the one shared list, deduped by id.
  function handleCategoryCreated(category: MonthlyCategoryOptionDTO) {
    setCategories((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category]));
    router.refresh();
  }

  function handleCategoryUpdated(category: MonthlyCategoryOptionDTO) {
    setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)));
    router.refresh();
  }

  function handleCategoryDeleted(categoryId: string) {
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-sheet-header px-6 py-4">
        <h1 className="font-display text-xl font-bold text-sheet-header">Monthly Base</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowManageCategories((s) => !s)}
            className="focus-ring text-sm font-medium text-folio underline decoration-dotted"
          >
            {showManageCategories ? "Hide Categories" : "Manage Categories"}
          </button>
          <button
            type="button"
            onClick={handleAddRow}
            className="focus-ring rounded bg-sheet-header px-4 py-2 text-sm font-semibold text-paper hover:opacity-90"
          >
            + Add Line Item
          </button>
        </div>
      </div>

      {showManageCategories && (
        <ManageCategoriesPanel
          categories={categories}
          onCategoryCreated={handleCategoryCreated}
          onCategoryUpdated={handleCategoryUpdated}
          onCategoryDeleted={handleCategoryDeleted}
        />
      )}

      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-sheet-header text-paper">
            <th className="w-[44%] border border-sheet-border px-3 py-2 text-left font-bold">
              Expense
            </th>
            <th className="w-[32%] border border-sheet-border px-3 py-2 text-left font-bold">
              Category
            </th>
            <th className="w-[20%] border border-sheet-border px-3 py-2 text-right font-bold">
              Base
            </th>
            <th className="w-10 border border-sheet-border px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group bg-sheet-row">
              <td className="border border-sheet-border p-0">
                <input
                  ref={(el) => {
                    nameInputRefs.current[row.id] = el;
                  }}
                  defaultValue={row.name}
                  placeholder="Expense description…"
                  onBlur={(e) => handleNameBlur(row.id, e.target.value)}
                  className="w-full border-0 bg-transparent px-3 py-2 text-ink focus:bg-white/80 focus:outline-none"
                />
              </td>
              <td className="border border-sheet-border p-0">
                <CategoryCombobox
                  categories={categories}
                  value={row.categoryId}
                  onChange={(categoryId) => handleCategoryChange(row.id, categoryId)}
                  onCreated={handleCategoryCreated}
                />
              </td>
              <td className="border border-sheet-border p-0">
                <input
                  type="number"
                  step="any"
                  value={row.baseAmount}
                  onChange={(e) => handleBaseChange(row.id, e.target.value)}
                  onBlur={(e) => handleBaseBlur(row.id, e.target.value)}
                  className="w-full border-0 bg-transparent px-3 py-2 text-right text-ink [font-variant-numeric:tabular-nums] focus:bg-white/80 focus:outline-none"
                />
              </td>
              <td className="border border-sheet-border px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => handleDelete(row.id)}
                  title="Delete row"
                  className="text-lg font-bold leading-none text-coral opacity-40 transition-opacity group-hover:opacity-100"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-sheet-header text-paper font-bold">
            <td className="border border-sheet-border px-3 py-2">Total</td>
            <td className="border border-sheet-border px-3 py-2" />
            <td className="border border-sheet-border px-3 py-2 text-right [font-variant-numeric:tabular-nums]">
              {formatTotal(total)}
            </td>
            <td className="border border-sheet-border px-2 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
