"use client";

import { useEffect, useRef } from "react";
import { formatDashboardAmount } from "@/lib/dashboard-format";
import { macroGroupColorHex, formatMacroPercent } from "@/lib/dashboard-macro-groups";

// Same visual pattern as CategoryBreakupDonut (70% cutout, total centered)
// applied to the dashboard's Macro Allocation buckets — replaces the
// segmented-bar-plus-legend block that used to render inline in page.tsx.
// macroGroups/macroTotal are computed once in page.tsx and passed straight
// through; this component never recomputes the allocation itself.
export default function AssetDistributionDonut({
  macroGroups,
  macroTotal,
  baseCurrency,
}: {
  macroGroups: { label: string; color: string; total: number }[];
  macroTotal: number;
  baseCurrency: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (macroGroups.length === 0) return;
    let chart: any;
    let cancelled = false;
    const isDark = document.documentElement.classList.contains("dark");

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels: macroGroups.map((g) => g.label),
          datasets: [
            {
              data: macroGroups.map((g) => g.total),
              backgroundColor: macroGroups.map((g) => macroGroupColorHex(g.color, isDark)),
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: { legend: { display: false } },
        },
      });
    });

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [macroGroups]);

  if (macroGroups.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">No assets added yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div style={{ position: "relative", width: "100%", height: 220 }}>
        <canvas ref={canvasRef} />
        <div
          style={{ position: "absolute", top: "42%", left: "50%", transform: "translate(-50%, -50%)" }}
          className="pointer-events-none text-center"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total</p>
          <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
            {formatDashboardAmount(macroTotal, baseCurrency)}
          </p>
        </div>
      </div>

      {/* Legend kept as text below the chart, same as before this became a
          donut — the amount + % detail per bucket doesn't fit inside a
          small donut's own legend. */}
      <div className="flex flex-wrap gap-4 pt-1 text-xs font-semibold">
        {macroGroups.map((g) => (
          <span key={g.label} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className={`h-2.5 w-2.5 rounded-full ${g.color}`} />
            {g.label}: {formatDashboardAmount(g.total, baseCurrency)} ({formatMacroPercent((g.total / macroTotal) * 100)})
          </span>
        ))}
      </div>
    </div>
  );
}
