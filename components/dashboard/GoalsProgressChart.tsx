"use client";

import { useEffect, useRef } from "react";
import { formatDashboardAmount } from "@/lib/dashboard-format";
import type { GoalProgress } from "@/lib/dashboard-data";

// Goal.currency is a per-goal free choice, not locked to the household's
// base currency — plotting raw target/current amounts for every goal on one
// shared axis would silently mix currencies. % progress is currency-agnostic
// and honest instead; the tooltip still surfaces the real per-goal amounts,
// since that's meaningful on its own, just not as a cross-goal axis position.
const ON_TRACK_LIGHT = "#10b981"; // emerald-500
const ON_TRACK_DARK = "#22d3ee"; // cyan-400
const BEHIND_LIGHT = "#f43f5e"; // rose-500
const BEHIND_DARK = "#fb7185"; // rose-400

// Replaces GoalVelocityCard entirely in the Operational Context Rail — one
// horizontal bar per goal instead of a single featured "biggest goal" card.
export default function GoalsProgressChart({
  goals,
  householdWideNote = false,
}: {
  goals: GoalProgress[];
  // Goal is never scoped to a familyMemberId in the schema — this chart
  // never actually narrows down when the dashboard's member filter is
  // active. True while that filter is active, to caption the card rather
  // than silently ignore the filter (same convention as the card this
  // replaces used).
  householdWideNote?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (goals.length === 0) return;
    let chart: any;
    let cancelled = false;
    const isDark = document.documentElement.classList.contains("dark");
    const onTrackColor = isDark ? ON_TRACK_DARK : ON_TRACK_LIGHT;
    const behindColor = isDark ? BEHIND_DARK : BEHIND_LIGHT;
    const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
    const tickColor = isDark ? "#94a3b8" : "#64748b";

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: goals.map((g) => g.name),
          datasets: [
            {
              data: goals.map((g) => g.pct),
              backgroundColor: goals.map((g) => (g.targetReached || g.onTrack ? onTrackColor : behindColor)),
              borderRadius: 4,
              barThickness: 16,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              min: 0,
              max: 100,
              ticks: { color: tickColor, callback: (v: any) => `${v}%` },
              grid: { color: gridColor },
            },
            y: {
              ticks: { color: tickColor, font: { size: 11 } },
              grid: { display: false },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  const g = goals[context.dataIndex];
                  return `${formatDashboardAmount(g.currentAmount, g.currency)} of ${formatDashboardAmount(g.targetAmount, g.currency)} (${g.pct}%)`;
                },
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
  }, [goals]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Milestone Engine{householdWideNote && <span className="font-normal normal-case tracking-normal"> (household-wide)</span>}
      </span>

      {goals.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          No goals added yet — add one to track pacing toward it.
        </p>
      ) : (
        <div className="mt-3" style={{ height: Math.max(120, goals.length * 40) }}>
          <canvas ref={canvasRef} />
        </div>
      )}
    </div>
  );
}
