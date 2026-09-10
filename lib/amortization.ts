// Amortization is computed live from outstandingBalance + interestRate +
// emiAmount — there's no stored schedule anywhere. Loans with a null/0
// interestRate (credit card rolling balances, 0%-interest device EMIs) are
// non-amortizing: they're just a running balance, no principal/interest split.

export type AmortizationBreakdown = {
  isAmortizing: boolean; // false if interestRate is null/0
  monthlyInterest: number | null; // this month's interest portion of the EMI
  monthlyPrincipal: number | null; // this month's principal portion of the EMI
  percentPaidOff: number | null; // 0-100, requires originalAmount; null if originalAmount missing
  monthsRemaining: number | null; // computed from balance/rate/EMI if amortizing, else from targetPayoffDate
};

export function computeAmortization(
  liability: {
    outstandingBalance: number;
    originalAmount: number | null;
    interestRate: number | null;
    emiAmount: number | null;
    targetPayoffDate: Date | null;
  },
  now: Date = new Date()
): AmortizationBreakdown {
  const isAmortizing = !!liability.interestRate && liability.interestRate > 0 && !!liability.emiAmount;

  const percentPaidOff =
    liability.originalAmount && liability.originalAmount > 0
      ? Math.max(0, Math.min(100, ((liability.originalAmount - liability.outstandingBalance) / liability.originalAmount) * 100))
      : null;

  if (!isAmortizing) {
    // Non-amortizing (credit card, 0% EMI): no interest/principal split.
    // monthsRemaining falls back to targetPayoffDate if set, else null.
    const monthsRemaining = liability.targetPayoffDate
      ? Math.max(0, Math.round((liability.targetPayoffDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
      : null;
    return { isAmortizing: false, monthlyInterest: null, monthlyPrincipal: null, percentPaidOff, monthsRemaining };
  }

  const monthlyRate = (liability.interestRate as number) / 100 / 12;
  const monthlyInterest = liability.outstandingBalance * monthlyRate;
  const monthlyPrincipal = Math.max(0, (liability.emiAmount as number) - monthlyInterest);

  // Standard reducing-balance projection: how many more EMIs to zero the
  // balance at the current rate/EMI. Guards against emiAmount too small
  // to ever cover interest (would never amortize) by capping the loop.
  let balance = liability.outstandingBalance;
  let months = 0;
  const MAX_MONTHS = 1200; // 100 years, safety cap
  while (balance > 0 && months < MAX_MONTHS) {
    const interest = balance * monthlyRate;
    const principal = (liability.emiAmount as number) - interest;
    if (principal <= 0) {
      months = MAX_MONTHS;
      break;
    } // EMI doesn't cover interest — never pays off
    balance -= principal;
    months++;
  }
  const monthsRemaining = months >= MAX_MONTHS ? null : months;

  return { isAmortizing: true, monthlyInterest, monthlyPrincipal, percentPaidOff, monthsRemaining };
}

// Year-by-year projection for the Debt Payoff Timeline chart. Returns
// total outstanding balance across all amortizing liabilities at the end
// of each year, walking the same reducing-balance math forward.
export function projectDebtPayoffTimeline(
  liabilities: { outstandingBalance: number; interestRate: number | null; emiAmount: number | null }[],
  yearsAhead = 15
): { year: number; totalBalance: number }[] {
  const currentYear = new Date().getFullYear();
  const balances = liabilities.map((l) => ({
    balance: l.outstandingBalance,
    monthlyRate: l.interestRate && l.interestRate > 0 ? l.interestRate / 100 / 12 : 0,
    emi: l.emiAmount ?? 0,
    amortizing: !!l.interestRate && l.interestRate > 0 && !!l.emiAmount,
  }));

  const points: { year: number; totalBalance: number }[] = [];
  for (let y = 0; y <= yearsAhead; y++) {
    if (y > 0) {
      for (const b of balances) {
        if (!b.amortizing || b.balance <= 0) continue;
        for (let m = 0; m < 12 && b.balance > 0; m++) {
          const interest = b.balance * b.monthlyRate;
          const principal = b.emi - interest;
          if (principal <= 0) break; // stalls — leave remaining balance flat rather than go negative
          b.balance = Math.max(0, b.balance - principal);
        }
      }
    }
    const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);
    points.push({ year: currentYear + y, totalBalance });
  }
  return points;
}
