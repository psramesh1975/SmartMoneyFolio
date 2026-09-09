"use client";

import { useEffect, useRef } from "react";

export default function AllocationChart({
  labels,
  actual,
  target,
}: {
  labels: string[];
  actual: number[];
  target: number[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let chart: any;
    let cancelled = false;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: "Actual", data: actual, backgroundColor: "#2F5FD1", borderRadius: 3 },
            { label: "Target", data: target, backgroundColor: "#E2E6F0", borderRadius: 3 },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 12 } } } },
          scales: {
            x: { ticks: { callback: (v) => v + "%" }, grid: { color: "#F4F6FB" } },
            y: { grid: { display: false }, ticks: { font: { size: 12 } } },
          },
        },
      });
    });

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [labels, actual, target]);

  return (
    <div style={{ position: "relative", width: "100%", height: 260 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
