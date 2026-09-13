"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TABLE_THEMES } from "@/lib/table-themes";

// 8 clickable color swatches, one per preset — saves optimistically to the
// household record (PATCH /api/settings/table-theme) and reverts on
// failure. router.refresh() re-fetches the server-rendered table with the
// new theme, since the theme lives on the household record the table pages
// already fetch, rather than needing a separate per-page save.
export default function TableThemeSwitcher({ currentTheme }: { currentTheme: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(currentTheme);

  async function handleSelect(key: string) {
    if (key === selected || saving) return;
    setSelected(key); // optimistic — swatches feel instant
    setSaving(true);
    const res = await fetch("/api/settings/table-theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableTheme: key }),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh(); // re-fetch the server-rendered table with the new theme
    } else {
      setSelected(currentTheme); // revert on failure
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Theme
      </span>
      <div className="flex items-center gap-1.5">
        {TABLE_THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={selected === t.key}
            onClick={() => handleSelect(t.key)}
            disabled={saving}
            className={`h-5 w-5 rounded-full border-2 transition disabled:opacity-50 ${
              selected === t.key ? "border-slate-900 dark:border-white" : "border-white dark:border-slate-900"
            }`}
            style={{ backgroundColor: t.primary }}
          />
        ))}
      </div>
    </div>
  );
}
