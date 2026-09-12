import { formatCurrency } from "@/lib/format-currency";
import { getGoalPacing, type PrimaryGoal } from "@/lib/dashboard-data";

// Featured goal for the context rail — whichever goal getPrimaryGoal()
// picked (largest target amount). Reuses getGoalPacing(), the same pacing
// math the full /goals-linked dashboard section used before this revamp, so
// "months left / needs X/mo" reads identically wherever it appears.
export default function GoalVelocityCard({ goal }: { goal: PrimaryGoal | null }) {
  if (!goal) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Goal velocity</h3>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          No goals added yet — add one to track pacing toward it.
        </p>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((goal.currentAmount / (goal.targetAmount || 1)) * 100));
  const pacing = getGoalPacing({
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: goal.targetDate,
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Goal velocity</h3>
        <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">{pct}%</span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-slate-900 dark:text-white">{goal.name}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {formatCurrency(goal.currentAmount, goal.currency)} of {formatCurrency(goal.targetAmount, goal.currency)}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded bg-slate-100 dark:bg-white/5">
        <div className="h-full bg-blue-600 dark:bg-lime-400" style={{ width: `${pct}%` }} />
      </div>

      {pacing.isOverdue ? (
        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          Target date passed — {formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount), goal.currency)}{" "}
          still needed.
        </p>
      ) : goal.targetDate === null ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No target date set.</p>
      ) : pacing.requiredMonthlyRate === 0 ? (
        <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-cyan-400">Target reached 🎉</p>
      ) : (
        pacing.requiredMonthlyRate !== null && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {pacing.monthsRemaining} months left · needs {formatCurrency(pacing.requiredMonthlyRate, goal.currency)}/mo
          </p>
        )
      )}
    </div>
  );
}
