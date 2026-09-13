"use client";

import { useEffect, useRef } from "react";
import type { MonthlyTrendPoint } from "@/lib/dashboard-data";

// Household-wide, 6-month cash-flow trend — Monthly Tracking entries have no
// familyMemberId, so this chart is never scoped by the dashboard's member
// filter (same reasoning as GoalsProgressChart/CategoryBreakupDonut here).
export default function IncomeOutflowTrendChart({
  trend,
  baseCurrency,
}: {
  trend: MonthlyTrendPoint[];
  baseCurrency: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isAllZero = trend.every((p) => p.income === 0 && p.outflow === 0);

  useEffect(() => {
    if (isAllZero) return;
    let chart: any;
    let cancelled = false;
    const isDark = document.documentElement.classList.contains("dark");
    const incomeColor = isDark ? "#22d3ee" : "#059669";
    const outflowColor = isDark ? "#fb7185" : "#e11d48";
    const netColor = isDark ? "#c084fc" : "#4f46e5";
    const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
    const tickColor = isDark ? "#94a3b8" : "#64748b";

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        data: {
          labels: trend.map((p) => p.label),
          datasets: [
            {
              type: "bar",
              label: "Income",
              data: trend.map((p) => p.income),
              backgroundColor: incomeColor,
              borderRadius: 4,
              order: 2,
            },
            {
              type: "bar",
              label: "Outflow",
              data: trend.map((p) => p.outflow),
              backgroundColor: outflowColor,
              borderRadius: 4,
              order: 2,
            },
            {
              type: "line",
              label: "Net Surplus",
              data: trend.map((p) => p.netSurplus),
              borderColor: netColor,
              backgroundColor: netColor,
              tension: 0.3,
              pointRadius: 3,
              fill: false,
              order: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { display: false } },
            y: {
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
  }, [trend, baseCurrency, isAllZero]);

  if (isAllZero) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Start using Monthly Tracker to see your cash flow trend here.
      </p>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: 280 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
