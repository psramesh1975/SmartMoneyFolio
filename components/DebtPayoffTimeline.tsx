"use client";

import { useEffect, useRef, useState } from "react";

export default function DebtPayoffTimeline({
  points,
  currency,
}: {
  points: { year: number; totalBalance: number }[];
  currency: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Default to the light palette on first render (server/client agree, no
  // hydration mismatch), then sync the real theme after mount — same
  // pattern as AllocationDonut.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    let chart: any;
    let cancelled = false;
    const lineColor = isDark ? "#fb7185" : "#e11d48"; // coral — debt going down is the goal

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels: points.map((p) => String(p.year)),
          datasets: [
            {
              label: "Outstanding balance",
              data: points.map((p) => Math.round(p.totalBalance)),
              borderColor: lineColor,
              backgroundColor: lineColor,
              tension: 0.25,
              pointRadius: 3,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => `${currency} ${Number(ctx.raw).toLocaleString()}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: {
              ticks: {
                callback: (v: any) => Number(v).toLocaleString(),
                font: { size: 11 },
              },
            },
          },
        },
      });
    });

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [points, currency, isDark]);

  if (points.length === 0 || points.every((p) => p.totalBalance === 0)) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add an interest-bearing liability with a monthly EMI to see a payoff projection.
      </p>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: 240 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
