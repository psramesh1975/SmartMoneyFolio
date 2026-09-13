"use client";

import { useEffect, useRef } from "react";
import { MACRO_ALLOCATION_GROUPS, macroGroupColorHex } from "@/lib/dashboard-macro-groups";

// Stacked bar, one bar per family member — segments are the same 4 Macro
// Allocation buckets + "Other" shown in AssetDistributionDonut, deliberately
// reusing that exact grouping/color mapping (rather than one segment per raw
// assetClass) so this chart and the donut above it agree on what each color
// means instead of introducing a third taxonomy/palette on the same page.
export default function MemberAllocationStackedBar({
  memberBreakdowns,
  baseCurrency,
}: {
  memberBreakdowns: { name: string; byClass: Record<string, number> }[];
  baseCurrency: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fold each member's raw byClass totals into the shared macro buckets.
  const bucketed = MACRO_ALLOCATION_GROUPS.map((group) => ({
    label: group.label,
    color: group.color,
    values: memberBreakdowns.map((m) =>
      group.classes.reduce((sum, cls) => sum + (m.byClass[cls] ?? 0), 0)
    ),
  })).filter((b) => b.values.some((v) => v > 0));

  const hasData = bucketed.length > 0 && memberBreakdowns.length > 0;

  useEffect(() => {
    if (!hasData) return;
    let chart: any;
    let cancelled = false;
    const isDark = document.documentElement.classList.contains("dark");
    const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
    const tickColor = isDark ? "#94a3b8" : "#64748b";

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: memberBreakdowns.map((m) => m.name),
          datasets: bucketed.map((b) => ({
            label: b.label,
            data: b.values,
            backgroundColor: macroGroupColorHex(b.color, isDark),
            borderRadius: 4,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, ticks: { color: tickColor, font: { size: 11 } }, grid: { display: false } },
            y: {
              stacked: true,
              ticks: {
                color: tickColor,
                callback: (v: any) => `${baseCurrency} ${Math.round(Number(v)).toLocaleString()}`,
              },
              grid: { color: gridColor },
            },
          },
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 }, color: tickColor } },
          },
        },
      });
    });

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [memberBreakdowns, bucketed, hasData, baseCurrency]);

  if (!hasData) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">No assets added yet.</p>;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: 260 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
