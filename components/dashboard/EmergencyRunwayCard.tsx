// High-contrast slate card for the context rail — deliberately the one dark
// card among otherwise-white KPI cards, so the "how long could we coast"
// number reads as the rail's headline figure at a glance. Same
// financialRunway value as computed in getDashboardHeadlineKPIs (liquidBuffer
// ÷ avg 3-month actual outflow, null when there's no completed-month history
// yet) — not recomputed here, just re-presented.
export default function EmergencyRunwayCard({
  financialRunway,
  householdWideNote = false,
}: {
  financialRunway: number | null;
  // Monthly Tracking (the burn-rate half of this figure) has no
  // familyMemberId in the schema — this stays the household's runway even
  // while the dashboard's member filter is active. True while that filter
  // is active, to caption the card rather than silently ignore the filter.
  householdWideNote?: boolean;
}) {
  const hasData = financialRunway !== null;

  return (
    <div
      data-testid="runway-gauge"
      className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-sm"
    >
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-bold uppercase tracking-wider">
          Emergency Buffer{householdWideNote && <span className="font-normal normal-case tracking-normal"> (household-wide)</span>}
        </span>
        <span className={`h-2 w-2 rounded-full ${hasData ? "animate-pulse bg-emerald-400" : "bg-slate-600"}`} />
      </div>
      <p className="mt-2 text-2xl font-extrabold text-emerald-400">
        {hasData ? `${financialRunway.toFixed(1)} Months` : "—"}
      </p>
      <p className="mt-2 text-xs text-slate-300">
        {hasData
          ? `Safe-to-spend liquidity across liquid accounts covers ${financialRunway.toFixed(1)} months of living expenses.`
          : "Not enough Monthly Tracking history yet to estimate a safe runway."}
      </p>
    </div>
  );
}
