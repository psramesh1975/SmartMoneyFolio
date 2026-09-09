// Shared by the month API, the year API, and both client components so the
// Planned/Actual/Net Surplus numbers are computed identically everywhere.
//
// actualAmount is treated as plannedAmount when not yet filled in, so the
// running Actual total stays meaningful mid-month. Skipped entries are
// excluded from both totals entirely.

export type MonthlySummaryInput = {
  categoryType: "INCOME" | "OUTFLOW";
  plannedAmount: number | string;
  actualAmount: number | string | null;
  isSkipped: boolean;
};

export type MonthlySummary = {
  plannedIncome: number;
  plannedOutflow: number;
  actualIncome: number;
  actualOutflow: number;
  netSurplusPlanned: number;
  netSurplusActual: number;
};

export function computeMonthlySummary(entries: MonthlySummaryInput[]): MonthlySummary {
  let plannedIncome = 0;
  let plannedOutflow = 0;
  let actualIncome = 0;
  let actualOutflow = 0;

  for (const e of entries) {
    if (e.isSkipped) continue;
    const planned = Number(e.plannedAmount);
    const actual = e.actualAmount == null ? planned : Number(e.actualAmount);
    if (e.categoryType === "INCOME") {
      plannedIncome += planned;
      actualIncome += actual;
    } else {
      plannedOutflow += planned;
      actualOutflow += actual;
    }
  }

  return {
    plannedIncome,
    plannedOutflow,
    actualIncome,
    actualOutflow,
    netSurplusPlanned: plannedIncome - plannedOutflow,
    netSurplusActual: actualIncome - actualOutflow,
  };
}
