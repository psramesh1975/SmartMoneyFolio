"use client";

import { useEffect, useRef, useState } from "react";

export type SecurityResult = {
  id: string;
  tickerOrCode: string;
  name: string;
  exchange: string | null;
  lastPrice: string | null;
  securityType: string;
};

// Plain debounced combobox — no new dependency, a controlled <input> +
// absolutely-positioned results list matches the rest of this codebase's
// lightweight approach (see CategoryCombobox.tsx for the same pattern).
export default function AssetAutocomplete({
  type,
  onSelect,
  placeholder = "Search by name...",
}: {
  type: "MUTUAL_FUND" | "STOCK";
  onSelect: (security: SecurityResult) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SecurityResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const thisRequest = ++requestId.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/securities/search?q=${encodeURIComponent(query)}&type=${type}`);
        const data = await res.json();
        if (requestId.current !== thisRequest) return; // a newer keystroke has already fired
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        if (requestId.current !== thisRequest) return;
        setResults([]);
      } finally {
        if (requestId.current === thisRequest) setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, type]);

  function handleSelect(security: SecurityResult) {
    setQuery(security.name);
    setOpen(false);
    setResults([]);
    onSelect(security);
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="focus-ring w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
      />
      {open && (loading || results.length > 0) && (
        <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto border border-slate-200/80 bg-white shadow-lg dark:border-slate-800 dark:bg-canvas-card">
          {loading && <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">Searching…</p>}
          {!loading &&
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                className="focus-ring flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <span className="text-sm text-slate-900 dark:text-white">{r.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {r.tickerOrCode}
                  {r.exchange ? ` · ${r.exchange}` : ""}
                  {r.lastPrice ? ` · last ${Number(r.lastPrice).toLocaleString()}` : ""}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
