"use client";

import { useEffect, useRef } from "react";
import { formatDashboardAmount } from "@/lib/dashboard-format";
import { liabilityTypeLabel } from "@/lib/liability-categories";
import type { LiabilityTypeBreakdown } from "@/lib/dashboard-data";

// Jewel-tone palette — same families CategoryBreakupDonut cycles through,
// deliberately reused rather than invented fresh, so a donut chart anywhere
// on the dashboard reads as part of one visual system.
const LIGHT_COLORS = ["#e11d48", "#d97706", "#2563eb", "#4f46e5", "#0891b2", "#65a30d"];
const DARK_COLORS = ["#fb7185", "#fbbf24", "#60a5fa", "#818cf8", "#67e8f9", "#bef264"];

// New "Debt Composition" card — doesn't replace anything, this breakdown
// simply didn't exist on the dashboard before. A household with zero debt is
// a fine, common state, not an error, so the empty state below is neutral.
export default function LiabilitiesDonut({
  breakdown,
  baseCurrency,
}: {
  breakdown: LiabilityTypeBreakdown;
  baseCurrency: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const total = breakdown.reduce((sum, b) => sum + b.total, 0);

  useEffect(() => {
    if (breakdown.length === 0) return;
    let chart: any;
    let cancelled = false;
    const isDark = document.documentElement.classList.contains("dark");
    const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels: breakdown.map((b) => liabilityTypeLabel(b.liabilityType)),
          datasets: [
            {
              data: breakdown.map((b) => b.total),
              backgroundColor: breakdown.map((_, i) => palette[i % palette.length]),
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
          },
        },
      });
    });

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [breakdown]);

  if (breakdown.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">No liabilities recorded yet.</p>;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: 260 }}>
      <canvas ref={canvasRef} />
      <div
        style={{ position: "absolute", top: "42%", left: "50%", transform: "translate(-50%, -50%)" }}
        className="pointer-events-none text-center"
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Outstanding</p>
        <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          {formatDashboardAmount(total, baseCurrency)}
        </p>
      </div>
    </div>
  );
}
