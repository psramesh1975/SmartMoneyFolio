"use client";

import { useEffect, useRef, useState } from "react";
import type { MonthlyCategoryOptionDTO } from "@/lib/monthly-types";
import { categoryBadgeTone } from "@/lib/monthly-badge";

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function CategoryCombobox({
  value,
  categories,
  onChange,
  onCreated,
}: {
  value: string | null;
  categories: MonthlyCategoryOptionDTO[];
  onChange: (categoryId: string) => void;
  onCreated: (category: MonthlyCategoryOptionDTO) => void;
}) {
  const selected = categories.find((c) => c.id === value) ?? null;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep the displayed text in sync when the selected category changes from
  // outside — another combobox created it, or Manage Categories renamed it —
  // while this one isn't the one being edited right now.
  useEffect(() => {
    if (!open) setQuery(selected?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.name]);

  const q = query.trim().toLowerCase();
  const filtered = q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
  const exactMatch = categories.some((c) => c.name.toLowerCase() === q);
  const showCreate = q.length > 0 && !exactMatch;

  function revert() {
    setQuery(selected?.name ?? "");
    setOpen(false);
  }

  function selectCategory(cat: MonthlyCategoryOptionDTO) {
    onChange(cat.id);
    setQuery(cat.name);
    setOpen(false);
  }

  async function createAndSelect() {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    const { ok, status, data } = await postJSON("/api/monthly/categories", {
      name,
      type: "OUTFLOW", // new inline categories default to Outflow; fix in Manage Categories if wrong
    });
    setCreating(false);

    if (ok) {
      const category: MonthlyCategoryOptionDTO = { id: data.category.id, name, type: "OUTFLOW" };
      onCreated(category);
      selectCategory(category);
      return;
    }

    if (status === 409) {
      // Someone else created the same name a moment ago — pick up the real
      // one instead of erroring.
      const res = await fetch("/api/monthly/categories");
      const list = await res.json().catch(() => ({ categories: [] }));
      const match = (list.categories ?? []).find(
        (c: { name: string }) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (match) {
        const category: MonthlyCategoryOptionDTO = {
          id: match.id,
          name: match.name,
          type: match.type,
        };
        onCreated(category);
        selectCategory(category);
      }
      return;
    }

    revert();
  }

  const tone = categoryBadgeTone(selected?.type);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            revert();
            inputRef.current?.blur();
          }
        }}
        onBlur={() => {
          // An option's onMouseDown calls preventDefault, so a real click on
          // it never reaches this blur at all — this only fires for a
          // genuine blur-away-without-selecting.
          if (open) revert();
        }}
        placeholder="Choose or type…"
        className={`focus-ring w-full rounded px-2 py-1 text-xs font-semibold ${tone}`}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-56 max-h-56 overflow-auto border border-sheet-border bg-sheet-row shadow-md">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selectCategory(c);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink hover:bg-white/40"
            >
              <span>{c.name}</span>
              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeTone(c.type)}`}>
                {c.type === "INCOME" ? "Income" : "Outflow"}
              </span>
            </button>
          ))}
          {filtered.length === 0 && !showCreate && (
            <p className="px-3 py-2 text-sm text-ink-2">No matches</p>
          )}
          {showCreate && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                createAndSelect();
              }}
              disabled={creating}
              className="w-full border-t border-sheet-border px-3 py-2 text-left text-sm font-medium text-ink hover:bg-white/40 disabled:opacity-60"
            >
              {creating ? "Creating…" : `Create category: "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
