"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountOptionDTO, LiabilityOptionDTO, MonthlyBaseRowDTO, MonthlyCategoryOptionDTO } from "@/lib/monthly-types";
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
  // Opt-in link: "this recurring expense is the EMI for that loan". null =
  // not linked, the default and common case.
  liabilityId: string | null;
  // Opt-in link: "this recurring expense is the SIP for that mutual fund
  // holding". Mutually exclusive with liabilityId — picking one clears the
  // other, both here and server-side.
  accountId: string | null;
};

function makeTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function MonthlyBaseClient({
  initialLineItems,
  initialCategories,
  liabilities,
  accounts,
}: {
  initialLineItems: MonthlyBaseRowDTO[];
  initialCategories: MonthlyCategoryOptionDTO[];
  liabilities: LiabilityOptionDTO[];
  accounts: AccountOptionDTO[];
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
      liabilityId: li.liabilityId,
      accountId: li.accountId,
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
        liabilityId: null,
        accountId: null,
      },
    ]);
    requestAnimationFrame(() => nameInputRefs.current[tempId]?.focus());
  }

  // Not created server-side until the user actually types a name (and a
  // category is available) — a click on "+ Add Line Item" alone never hits
  // the API.
  async function createRow(
    row: Row,
    overrides: Partial<Pick<Row, "name" | "categoryId" | "baseAmount" | "liabilityId" | "accountId">>
  ) {
    const name = (overrides.name ?? row.name).trim();
    const categoryId = overrides.categoryId ?? row.categoryId;
    const baseAmount = overrides.baseAmount ?? row.baseAmount;
    const liabilityId = overrides.liabilityId !== undefined ? overrides.liabilityId : row.liabilityId;
    const accountId = overrides.accountId !== undefined ? overrides.accountId : row.accountId;
    if (!name || !categoryId) return;
    const { ok, data } = await postJSON("/api/monthly/line-items", {
      categoryId,
      name,
      baseAmount: Number(baseAmount) || 0,
      liabilityId: liabilityId ?? undefined,
      accountId: accountId ?? undefined,
    });
    if (!ok) return;
    const newId = data.lineItem.id;
    rebindRef(row.id, newId);
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, id: newId, name, categoryId, baseAmount, liabilityId, accountId, persisted: true }
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

  // Selecting a liability suggests baseAmount = that loan's EMI (still
  // freely editable afterward, in case the EMI shown on the loan doesn't
  // match what's actually budgeted here). Mutually exclusive with the SIP
  // account link — a line item represents one real-world payment, so
  // picking a loan clears any linked account.
  async function handleLiabilityChange(rowId: string, rawValue: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const liabilityId = rawValue || null;
    const liability = liabilityId ? liabilities.find((l) => l.id === liabilityId) : undefined;
    const suggestedBase = liability?.emiAmount;
    const patch: Partial<Row> = { liabilityId, accountId: null };
    if (suggestedBase) patch.baseAmount = suggestedBase;
    updateRow(rowId, patch);

    if (row.persisted) {
      await patchJSON(`/api/monthly/line-items/${rowId}`, {
        liabilityId,
        accountId: null,
        ...(suggestedBase ? { baseAmount: Number(suggestedBase) } : {}),
      });
    } else if (row.name.trim() && row.categoryId) {
      await createRow(row, { liabilityId, accountId: null, ...(suggestedBase ? { baseAmount: suggestedBase } : {}) });
    }
  }

  // Selecting a mutual fund account suggests baseAmount = that fund's SIP
  // amount (still freely editable). Mutually exclusive with the linked
  // loan — picking an account clears any linked liability.
  async function handleAccountChange(rowId: string, rawValue: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const accountId = rawValue || null;
    const account = accountId ? accounts.find((a) => a.id === accountId) : undefined;
    const suggestedBase = account?.sipMonthlyAmount;
    const patch: Partial<Row> = { accountId, liabilityId: null };
    if (suggestedBase) patch.baseAmount = suggestedBase;
    updateRow(rowId, patch);

    if (row.persisted) {
      await patchJSON(`/api/monthly/line-items/${rowId}`, {
        accountId,
        liabilityId: null,
        ...(suggestedBase ? { baseAmount: Number(suggestedBase) } : {}),
      });
    } else if (row.name.trim() && row.categoryId) {
      await createRow(row, { accountId, liabilityId: null, ...(suggestedBase ? { baseAmount: suggestedBase } : {}) });
    }
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
    <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200/80 px-6 py-4 dark:border-slate-800">
        <h1 className="text-base font-bold text-slate-900 dark:text-white">Monthly Base</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowManageCategories((s) => !s)}
            className="focus-ring text-sm font-medium text-blue-600 underline decoration-dotted dark:text-lime-400"
          >
            {showManageCategories ? "Hide Categories" : "Manage Categories"}
          </button>
          <button
            type="button"
            onClick={handleAddRow}
            className="focus-ring rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-lime-400 dark:text-slate-900 dark:hover:bg-lime-300"
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
          <tr className="bg-slate-900 text-white">
            <th className="w-[28%] border border-slate-200/80 dark:border-slate-800 px-3 py-2 text-left font-bold">
              Expense
            </th>
            <th className="w-[18%] border border-slate-200/80 dark:border-slate-800 px-3 py-2 text-left font-bold">
              Category
            </th>
            <th className="w-[14%] border border-slate-200/80 dark:border-slate-800 px-3 py-2 text-right font-bold">
              Base
            </th>
            <th className="w-[18%] border border-slate-200/80 dark:border-slate-800 px-3 py-2 text-left font-bold">
              Linked Loan
            </th>
            <th className="w-[18%] border border-slate-200/80 dark:border-slate-800 px-3 py-2 text-left font-bold">
              Linked SIP
            </th>
            <th className="w-10 border border-slate-200/80 dark:border-slate-800 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group bg-white dark:bg-canvas-card">
              <td className="border border-slate-200/80 dark:border-slate-800 p-0">
                <input
                  ref={(el) => {
                    nameInputRefs.current[row.id] = el;
                  }}
                  defaultValue={row.name}
                  placeholder="Expense description…"
                  onBlur={(e) => handleNameBlur(row.id, e.target.value)}
                  className="w-full border-0 bg-transparent px-3 py-2 text-slate-900 dark:text-white focus:bg-slate-50 dark:focus:bg-white/5 focus:outline-none"
                />
              </td>
              <td className="border border-slate-200/80 dark:border-slate-800 p-0">
                <CategoryCombobox
                  categories={categories}
                  value={row.categoryId}
                  onChange={(categoryId) => handleCategoryChange(row.id, categoryId)}
                  onCreated={handleCategoryCreated}
                />
              </td>
              <td className="border border-slate-200/80 dark:border-slate-800 p-0">
                <input
                  type="number"
                  step="any"
                  value={row.baseAmount}
                  onChange={(e) => handleBaseChange(row.id, e.target.value)}
                  onBlur={(e) => handleBaseBlur(row.id, e.target.value)}
                  className="w-full border-0 bg-transparent px-3 py-2 text-right text-slate-900 dark:text-white [font-variant-numeric:tabular-nums] focus:bg-slate-50 dark:focus:bg-white/5 focus:outline-none"
                />
              </td>
              <td className="border border-slate-200/80 dark:border-slate-800 p-0">
                <select
                  value={row.liabilityId ?? ""}
                  onChange={(e) => handleLiabilityChange(row.id, e.target.value)}
                  className="w-full border-0 bg-transparent px-3 py-2 text-slate-900 dark:text-white focus:bg-slate-50 dark:focus:bg-white/5 focus:outline-none"
                >
                  <option value="">— None —</option>
                  {liabilities.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border border-slate-200/80 dark:border-slate-800 p-0">
                <select
                  value={row.accountId ?? ""}
                  onChange={(e) => handleAccountChange(row.id, e.target.value)}
                  className="w-full border-0 bg-transparent px-3 py-2 text-slate-900 dark:text-white focus:bg-slate-50 dark:focus:bg-white/5 focus:outline-none"
                >
                  <option value="">— None —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border border-slate-200/80 dark:border-slate-800 px-2 py-2 text-center">
                <button
                  type="button"
                  onClick={() => handleDelete(row.id)}
                  title="Delete row"
                  className="text-lg font-bold leading-none text-rose-600 opacity-40 transition-opacity group-hover:opacity-100"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-900 text-white font-bold">
            <td className="border border-slate-200/80 dark:border-slate-800 px-3 py-2">Total</td>
            <td className="border border-slate-200/80 dark:border-slate-800 px-3 py-2" />
            <td className="border border-slate-200/80 dark:border-slate-800 px-3 py-2 text-right [font-variant-numeric:tabular-nums]">
              {formatTotal(total)}
            </td>
            <td className="border border-slate-200/80 dark:border-slate-800 px-3 py-2" />
            <td className="border border-slate-200/80 dark:border-slate-800 px-3 py-2" />
            <td className="border border-slate-200/80 dark:border-slate-800 px-2 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
