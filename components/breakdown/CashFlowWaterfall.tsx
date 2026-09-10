"use client";

import { useEffect, useRef } from "react";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

// Chart.js has no native waterfall type — this builds one as a stacked
// horizontal bar: an invisible "offset" dataset stacked underneath the
// visible segment produces the floating-bar look, the standard technique.
export default function CashFlowWaterfall({
  waterfall,
  currency,
}: {
  waterfall: { income: number; fixedExpenses: number; variableExpenses: number; savings: number };
  currency: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let chart: any;
    let cancelled = false;
    const isDark = document.documentElement.classList.contains("dark");

    const { income, fixedExpenses, variableExpenses, savings } = waterfall;
    const labels = ["Income", "Fixed Expenses", "Variable Expenses", "Savings"];
    const offsets = [0, income - fixedExpenses, savings, 0];
    const values = [income, fixedExpenses, variableExpenses, savings];
    const colors = [
      isDark ? "#22d3ee" : "#059669", // Income — growth
      isDark ? "#fb7185" : "#e11d48", // Fixed Expenses — coral
      isDark ? "#fbbf24" : "#d97706", // Variable Expenses — amber
      savings >= 0 ? (isDark ? "#a3e635" : "#2563eb") : isDark ? "#fb7185" : "#e11d48", // Savings — folio, or coral if negative
    ];

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "offset",
              data: offsets,
              backgroundColor: "rgba(0,0,0,0)",
              stack: "waterfall",
            },
            {
              label: "amount",
              data: values,
              backgroundColor: colors,
              borderRadius: 3,
              stack: "waterfall",
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              filter: (ctx: any) => ctx.datasetIndex === 1,
              callbacks: {
                label: (ctx: any) => `${currency} ${fmt(Math.abs(Number(ctx.raw)))}`,
              },
            },
          },
          scales: {
            x: { stacked: true, ticks: { callback: (v: any) => fmt(Number(v)) } },
            y: { stacked: true, grid: { display: false }, ticks: { font: { size: 12 } } },
          },
        },
      });
    });

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [waterfall, currency]);

  return (
    <div style={{ position: "relative", width: "100%", height: 220 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
