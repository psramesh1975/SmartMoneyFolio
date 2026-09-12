import { formatDashboardAmount } from "@/lib/dashboard-format";
import type { PrimaryGoal } from "@/lib/dashboard-data";

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

// "Projected completion at current pace" — derived from the household's
// total active SIP commitment (getMonthlySipTotal), not from the pacing
// required to hit the goal's own target date (that's getGoalPacing(),
// used elsewhere). These are two different questions: this one answers
// "at the rate money is actually flowing in today, when would this finish?"
function projectCompletion(remaining: number, monthlySipTotal: number, now: Date): Date | null {
  if (monthlySipTotal <= 0 || remaining <= 0) return null;
  const monthsNeeded = Math.ceil(remaining / monthlySipTotal);
  const projected = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsNeeded, 1));
  return projected;
}

// Featured goal for the context rail — whichever goal getPrimaryGoal()
// picked (largest target amount). Status pill and projected-completion
// line are computed from real data (getMonthlySipTotal, the goal's own
// targetDate) rather than mirrored statically from the approved mockup.
export default function GoalVelocityCard({
  goal,
  monthlySipTotal,
  householdWideNote = false,
}: {
  goal: PrimaryGoal | null;
  monthlySipTotal: number;
  // The Goal model has no familyMemberId — goals are always household-wide,
  // so this card never actually narrows down when the dashboard's member
  // filter is active. True while that filter is active, to caption the
  // card rather than silently ignore the filter.
  householdWideNote?: boolean;
}) {
  if (!goal) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Milestone Engine
        </span>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          No goals added yet — add one to track pacing toward it.
        </p>
      </div>
    );
  }

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const pct = Math.min(100, Math.round((goal.currentAmount / (goal.targetAmount || 1)) * 1000) / 10);
  const now = new Date();
  const projected = projectCompletion(remaining, monthlySipTotal, now);

  const targetReached = remaining <= 0;
  const onTrack =
    targetReached ||
    !goal.targetDate ||
    !projected ||
    projected.getTime() <= goal.targetDate.getTime();

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Milestone Engine{householdWideNote && <span className="font-normal normal-case tracking-normal"> (household-wide)</span>}
        </span>
        <span
          className={`shrink-0 text-xs font-bold ${
            targetReached
              ? "text-emerald-600 dark:text-cyan-400"
              : onTrack
                ? "text-emerald-600 dark:text-cyan-400"
                : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {targetReached ? "Target Reached" : onTrack ? "On Track" : "Behind Pace"}
        </span>
      </div>

      <h4 className="mt-2 truncate text-sm font-extrabold text-slate-900 dark:text-white">
        {formatDashboardAmount(goal.targetAmount, goal.currency)} {goal.name}
      </h4>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
        <div className="h-full rounded-full bg-emerald-500 dark:bg-cyan-400" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
        <span>{formatDashboardAmount(goal.currentAmount, goal.currency)} accumulated</span>
        <span className="font-bold text-slate-900 dark:text-white">{pct}%</span>
      </div>

      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        {targetReached
          ? "Target reached 🎉"
          : projected
            ? `Projected completion: ${MONTH_YEAR.format(projected)} at current ${formatDashboardAmount(monthlySipTotal, goal.currency)} monthly SIP pace.`
            : "No active SIPs recorded yet — projected completion can't be estimated."}
      </p>
    </div>
  );
}
