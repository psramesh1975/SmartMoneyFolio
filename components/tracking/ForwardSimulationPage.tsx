// ForwardSimulationPage.tsx
// UI for the dynamic /tracking/[year]/[month] route when viewing a future
// draft month, matching the approved mockup exactly. Data (rows, totals,
// month label) should be passed in as props, sourced from real state.
//
// Copied from the approved mockup file as given, with two adjustments noted
// inline: the import path (per the file's own setup note), and one added
// SourceType — 'Monthly Base General' — for the app's real Monthly Base
// data, which (unlike the mockup's own EMI/SIP-only example) also includes
// plain recurring line items (rent, subscriptions, etc.). Layout is
// otherwise untouched.

import { formatINR } from '@/lib/format-indian-currency';

export type SourceType = 'Monthly Base EMI' | 'Monthly Base SIP' | 'Monthly Base General' | 'Advance Entry';
export type ExecutionStatus = 'Auto-Prepopulated' | 'Simulated Outflow';

export interface CommitmentRow {
  name: string;
  note?: string; // e.g. "Early booking logged so payment is accounted for"
  sourceType: SourceType;
  scheduleDate: string; // e.g. "15 Dec 2026"
  amount: number;
  status: ExecutionStatus;
}

interface ForwardSimulationPageProps {
  monthLabel: string; // e.g. "December 2026"
  projectedInflow: number;
  committedBaseAndSips: number;
  advanceEntriesTotal: number;
  advanceEntriesCount: number;
  rows: CommitmentRow[];
  onResetToBase?: () => void;
  onLogAdvanceExpense?: () => void;
}

export default function ForwardSimulationPage({
  monthLabel,
  projectedInflow,
  committedBaseAndSips,
  advanceEntriesTotal,
  advanceEntriesCount,
  rows,
  onResetToBase,
  onLogAdvanceExpense,
}: ForwardSimulationPageProps) {
  const buffer = projectedInflow - (committedBaseAndSips + advanceEntriesTotal);
  const isSurplus = buffer >= 0;

  const baselineCount = rows.filter((r) => r.sourceType !== 'Advance Entry').length;
  const advanceCount = rows.filter((r) => r.sourceType === 'Advance Entry').length;

  return (
    <div className="p-8 space-y-6">
      {/* Scenario Header Banner */}
      <div className="border border-indigo-200 bg-gradient-to-r from-indigo-900/10 via-purple-900/5 to-transparent rounded-2xl p-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-lg shrink-0">🔮</div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Forward Simulation: {monthLabel}
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Scenario Mode (Non-Final)
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Auto-populated with your recurring salary, SIPs, and home loan EMI from the{' '}
              <span className="font-bold text-slate-800">Monthly Base Plan</span>. Record future expenses to verify
              cash-flow surplus before committing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onResetToBase}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition whitespace-nowrap"
          >
            ↻ Reset to Base
          </button>
          <button
            onClick={onLogAdvanceExpense}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition whitespace-nowrap"
          >
            + Log Advance Expense
          </button>
        </div>
      </div>

      {/* Forward Cash-Flow Metric Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Projected Inflow</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{formatINR(projectedInflow)}</p>
          <p className="text-xs text-slate-500 mt-1">Salary baseline sync</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Committed (Base + SIPs)</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{formatINR(committedBaseAndSips)}</p>
          <p className="text-xs text-slate-500 mt-1">Recurring obligations</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border-2 border-amber-300 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Advance Entries (Planned)</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-2">{formatINR(advanceEntriesTotal)}</p>
          <p className="text-xs text-amber-700/80 mt-1">{advanceEntriesCount} advance expenses logged</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm ring-1 ring-emerald-500/20">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Projected Month Buffer</p>
          <p className={`text-2xl font-extrabold mt-2 ${isSurplus ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatINR(buffer)}
          </p>
          <p className={`text-xs font-semibold mt-1 ${isSurplus ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isSurplus ? '✓ Safe positive fit' : '⚠ Projected shortfall'}
          </p>
        </div>
      </section>

      {/* Planned Commitments Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-2 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              {monthLabel} Planned Commitments
            </h3>
            <p className="text-xs text-slate-500">Base commitments combined with early advance entries</p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {baselineCount} Baseline • {advanceCount} Advance Items
          </span>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="py-3 font-bold">Expense / Commitment</th>
              <th className="py-3 font-bold">Source Type</th>
              <th className="py-3 font-bold">Schedule Date</th>
              <th className="py-3 font-bold text-right">Planned Amount (₹)</th>
              <th className="py-3 font-bold text-right">Execution Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isAdvance = row.sourceType === 'Advance Entry';
              return (
                <tr
                  key={row.name}
                  className={`border-t border-slate-100 ${
                    isAdvance ? 'bg-amber-50/40 border-l-4 border-l-amber-500' : ''
                  }`}
                >
                  <td className="py-4 pl-1">
                    <p className="font-bold text-slate-900">{row.name}</p>
                    {row.note && <p className="text-xs text-amber-700/80 mt-0.5">{row.note}</p>}
                  </td>
                  <td className="py-4">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        row.sourceType === 'Monthly Base EMI'
                          ? 'bg-rose-100 text-rose-700'
                          : row.sourceType === 'Monthly Base SIP'
                          ? 'bg-blue-100 text-blue-700'
                          : row.sourceType === 'Monthly Base General'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {row.sourceType}
                    </span>
                  </td>
                  <td className="py-4 text-slate-600">{row.scheduleDate}</td>
                  <td className={`py-4 text-right font-mono font-bold ${isAdvance ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatINR(row.amount)}
                  </td>
                  <td className="py-4 text-right">
                    <span className={`text-xs font-bold ${isAdvance ? 'text-amber-700' : 'text-emerald-600'}`}>
                      {isAdvance ? '⚡ Simulated Outflow' : row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
