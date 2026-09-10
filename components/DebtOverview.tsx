"use client";

import { Fragment, useState } from "react";
import { computeAmortization } from "@/lib/amortization";

export type LiabilityRow = {
  id: string;
  familyMemberName: string;
  liabilityType: string;
  name: string;
  currency: string;
  outstandingBalance: string;
  originalAmount: string | null;
  interestRate: string | null;
  emiAmount: string | null;
  targetPayoffDate: string | null; // ISO date string, or null
};

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Read-only "What We Owe" table for the dashboard — same expand-to-reveal
// disclosure pattern used for liability rows on /liabilities, but without
// the add/delete surface, since this is a summary view, not the management
// page.
export default function DebtOverview({ liabilities, baseCurrency }: { liabilities: LiabilityRow[]; baseCurrency: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (liabilities.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No liabilities added yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200/80 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th className="px-4 py-2 font-medium">Loan / Liability</th>
            <th className="px-2 py-2 font-medium">Tagged Entity</th>
            <th className="px-2 py-2 text-right font-medium">Native Balance</th>
            <th className="px-2 py-2 text-right font-medium">Interest Rate</th>
            <th className="px-2 py-2 text-right font-medium">Monthly EMI</th>
            <th className="px-2 py-2 text-right font-medium">Target Payoff</th>
          </tr>
        </thead>
        <tbody>
          {liabilities.map((l) => {
            const isExpanded = expandedId === l.id;
            const breakdown = computeAmortization({
              outstandingBalance: Number(l.outstandingBalance),
              originalAmount: l.originalAmount ? Number(l.originalAmount) : null,
              interestRate: l.interestRate ? Number(l.interestRate) : null,
              emiAmount: l.emiAmount ? Number(l.emiAmount) : null,
              targetPayoffDate: l.targetPayoffDate ? new Date(l.targetPayoffDate) : null,
            });
            return (
              <Fragment key={l.id}>
                <tr
                  onClick={() => setExpandedId(isExpanded ? null : l.id)}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-white/5"
                >
                  <td className="px-4 py-2.5 text-slate-900 dark:text-white">
                    <span className="mr-1.5 inline-block w-3 text-center text-slate-400 dark:text-slate-500">
                      {isExpanded ? "–" : "+"}
                    </span>
                    {l.name}
                  </td>
                  <td className="px-2 py-2.5 text-slate-500 dark:text-slate-400">{l.familyMemberName}</td>
                  <td className="px-2 py-2.5 text-right text-slate-900 dark:text-white">
                    {l.currency} {fmt(Number(l.outstandingBalance))}
                    {l.currency !== baseCurrency && (
                      <span className="ml-1 text-slate-400 dark:text-slate-500">(not counted)</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right text-slate-500 dark:text-slate-400">
                    {l.interestRate ? `${l.interestRate}%` : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right text-slate-500 dark:text-slate-400">
                    {l.emiAmount ? `${l.currency} ${fmt(Number(l.emiAmount))}` : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right text-slate-500 dark:text-slate-400">
                    {formatDate(l.targetPayoffDate)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800/60 dark:bg-white/5">
                    <td colSpan={6} className="px-4 py-3">
                      {breakdown.isAmortizing ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">Monthly interest</p>
                            <p className="font-medium text-rose-600 dark:text-rose-400">
                              {l.currency} {fmt(breakdown.monthlyInterest ?? 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">Monthly principal</p>
                            <p className="font-medium text-emerald-600 dark:text-cyan-400">
                              {l.currency} {fmt(breakdown.monthlyPrincipal ?? 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400">Months remaining</p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {breakdown.monthsRemaining ?? "—"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400">Running balance — no interest.</p>
                      )}
                      {breakdown.percentPaidOff !== null ? (
                        <div className="mt-2 max-w-xs">
                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                            <span>Paid off</span>
                            <span>{Math.round(breakdown.percentPaidOff)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
                            <div
                              className="h-full bg-blue-600 dark:bg-lime-400"
                              style={{ width: `${breakdown.percentPaidOff}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-slate-500 dark:text-slate-400">
                          Add original loan amount to track payoff progress.
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
