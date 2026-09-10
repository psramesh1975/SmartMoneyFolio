"use client";

import { useEffect, useRef, useState } from "react";

// Same jewel-tone palette as the Phase 7 breakdown donut
// (components/breakdown/CategoryBreakupDonut.tsx) — folio, growth, amber,
// coral, folio-light, repeating for any classes beyond that.
const LIGHT_COLORS = ["#2563eb", "#059669", "#d97706", "#e11d48", "#4f46e5", "#0891b2", "#a855f7", "#65a30d"];
const DARK_COLORS = ["#60a5fa", "#22d3ee", "#fbbf24", "#fb7185", "#818cf8", "#67e8f9", "#c084fc", "#bef264"];

export default function AllocationDonut({
  labels,
  actual,
  target,
}: {
  labels: string[];
  actual: number[];
  target: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Default to the light palette on first render (server and client agree,
  // so no hydration mismatch), then sync the real theme after mount — same
  // pattern as MonthlyBreakdownPanel's localStorage read.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    let chart: any;
    let cancelled = false;
    const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: actual,
              backgroundColor: labels.map((_, i) => palette[i % palette.length]),
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${ctx.raw}%` } },
          },
        },
      });
    });

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [labels, actual, isDark]);

  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <div style={{ position: "relative", width: 200, height: 200 }} className="shrink-0">
        <canvas ref={canvasRef} />
      </div>
      <ul className="w-full space-y-2.5">
        {labels.map((label, i) => {
          const variance = actual[i] - target[i];
          const overTarget = variance > 5;
          const underTarget = variance < -5;
          return (
            <li key={label} className="text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: palette[i % palette.length] }}
                  />
                  <span className="truncate text-slate-900 dark:text-white">{label}</span>
                </span>
                <span className="shrink-0 text-slate-500 dark:text-slate-400">
                  {actual[i]}% <span className="text-slate-400 dark:text-slate-500">(target {target[i]}%)</span>
                </span>
              </div>
              {overTarget && (
                <p className="mt-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                  ▲ {variance}pt over target
                </p>
              )}
              {underTarget && (
                <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  ▼ {Math.abs(variance)}pt under target
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
