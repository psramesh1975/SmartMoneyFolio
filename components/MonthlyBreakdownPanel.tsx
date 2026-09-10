"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MonthlyBreakdown } from "@/lib/monthly-breakdown";
import CategoryBreakupDonut from "@/components/breakdown/CategoryBreakupDonut";
import VarianceTable from "@/components/breakdown/VarianceTable";
import CashFlowWaterfall from "@/components/breakdown/CashFlowWaterfall";
import DeltaVsPreviousMonth from "@/components/breakdown/DeltaVsPreviousMonth";
import SubscriptionTotal from "@/components/breakdown/SubscriptionTotal";
import UnpaidList from "@/components/breakdown/UnpaidList";

// Single global flag, not per-month — a user who expands this once almost
// certainly wants it expanded going forward, same precedent as the Phase 6
// theme toggle's single localStorage flag.
const STORAGE_KEY = "smf-breakdown-open";

export default function MonthlyBreakdownPanel({
  year,
  month,
  period,
  currency,
}: {
  year: number;
  month: number;
  period: "current" | "previous";
  currency: string;
}) {
  // Default false on first render to avoid an SSR/hydration mismatch — same
  // pattern as ThemeToggle — then sync from localStorage after mount.
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MonthlyBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // localStorage unavailable — stay collapsed.
    }
  }, []);

  // Lazy load: only fetch the first time the section is actually expanded,
  // never on mount even if localStorage says it should start open. Cached
  // afterward — toggling closed and back open doesn't re-fetch.
  useEffect(() => {
    if (!open || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    setLoading(true);
    setError(null);
    fetch(`/api/monthly/breakdown/${year}/${month}?period=${period}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.breakdown) setData(json.breakdown);
        else setError(json.error ?? "Couldn't load the breakdown.");
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [open, year, month, period]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable — state still toggles for this render.
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card">
      <button
        type="button"
        onClick={toggle}
        className="focus-ring flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronRight size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
        )}
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Monthly Breakdown</span>
      </button>

      {open && (
        <div className="space-y-6 border-t border-slate-200/80 p-4 dark:border-slate-800">
          {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {data && (
            <>
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Category breakdown
                </h3>
                <CategoryBreakupDonut
                  categoryBreakup={data.categoryBreakup}
                  totalSpend={data.totalSpend}
                  currency={currency}
                />
              </section>

              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Base vs Planned vs Actual
                </h3>
                <VarianceTable variance={data.variance} currency={currency} />
              </section>

              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Cash flow waterfall
                </h3>
                <CashFlowWaterfall waterfall={data.waterfall} currency={currency} />
              </section>

              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  vs previous month
                </h3>
                <DeltaVsPreviousMonth delta={data.deltaVsPreviousMonth} currency={currency} />
              </section>

              <section>
                <SubscriptionTotal subscriptions={data.subscriptions} currency={currency} />
              </section>

              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Unpaid / pending
                </h3>
                <UnpaidList unpaid={data.unpaid} currency={currency} />
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
