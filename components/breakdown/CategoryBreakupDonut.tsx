"use client";

import { useEffect, useRef } from "react";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

// Jewel-tone palette cycling through the app's accent colors, muted repeats
// if there are more categories than colors. Dark-mode swaps to the
// lime/cyan-tinted variants used elsewhere in the app.
const LIGHT_COLORS = ["#2563eb", "#059669", "#d97706", "#e11d48", "#4f46e5", "#0891b2", "#a855f7", "#65a30d"];
const DARK_COLORS = ["#60a5fa", "#22d3ee", "#fbbf24", "#fb7185", "#818cf8", "#67e8f9", "#c084fc", "#bef264"];

export default function CategoryBreakupDonut({
  categoryBreakup,
  totalSpend,
  currency,
}: {
  categoryBreakup: { categoryId: string; name: string; actualSpend: number }[];
  totalSpend: number;
  currency: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (categoryBreakup.length === 0) return;
    let chart: any;
    let cancelled = false;
    const isDark = document.documentElement.classList.contains("dark");
    const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels: categoryBreakup.map((c) => c.name),
          datasets: [
            {
              data: categoryBreakup.map((c) => c.actualSpend),
              backgroundColor: categoryBreakup.map((_, i) => palette[i % palette.length]),
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
  }, [categoryBreakup]);

  if (categoryBreakup.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No outflow entries recorded this period yet.
      </p>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: 260 }}>
      <canvas ref={canvasRef} />
      <div
        style={{ position: "absolute", top: "42%", left: "50%", transform: "translate(-50%, -50%)" }}
        className="pointer-events-none text-center"
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Total
        </p>
        <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          {currency} {fmt(totalSpend)}
        </p>
      </div>
    </div>
  );
}
