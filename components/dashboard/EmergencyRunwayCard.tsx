// High-contrast slate card for the context rail — deliberately the one dark
// card among otherwise-white KPI cards, so the "how long could we coast"
// number reads as the rail's headline figure at a glance. Same
// financialRunway value as SolvencyKPIRow's own card (liquidBuffer ÷
// avg 3-month actual outflow, null when there's no completed-month history
// yet) — not recomputed here, just re-presented.
export default function EmergencyRunwayCard({ financialRunway }: { financialRunway: number | null }) {
  return (
    <div
      data-testid="runway-gauge"
      className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-sm"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Emergency buffer</h3>
      <p className="mt-2 flex items-baseline gap-1.5 text-3xl font-black tracking-tight">
        <span>{financialRunway !== null ? financialRunway.toFixed(1) : "—"}</span>
        <span className="text-base font-semibold text-slate-300">months</span>
      </p>
      <p className="mt-2 text-xs text-slate-400">
        {financialRunway !== null
          ? "Liquid buffer ÷ 3-month avg actual outflow"
          : "Not enough Monthly Tracking history yet"}
      </p>
    </div>
  );
}
