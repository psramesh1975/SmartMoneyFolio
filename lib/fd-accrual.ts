// Simple accrual from principal, rate, and elapsed time since startDate,
// respecting compoundingFrequency. Computed live for display — nothing here
// is stored back onto the Account row.

export type CompoundingFrequencyValue = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL" | "AT_MATURITY";

export function computeFdCurrentValue(
  fd: {
    principal: number;
    interestRatePct: number;
    startDate: Date;
    compoundingFrequency: CompoundingFrequencyValue;
  },
  now: Date = new Date()
): number {
  const yearsElapsed = (now.getTime() - fd.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (yearsElapsed <= 0) return fd.principal;

  if (fd.compoundingFrequency === "AT_MATURITY") {
    // Simple interest, paid only at term end — still accrues for display purposes.
    return fd.principal * (1 + (fd.interestRatePct / 100) * yearsElapsed);
  }
  const periodsPerYear = { MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, ANNUAL: 1 }[fd.compoundingFrequency];
  const ratePerPeriod = fd.interestRatePct / 100 / periodsPerYear;
  const periodsElapsed = yearsElapsed * periodsPerYear;
  return fd.principal * Math.pow(1 + ratePerPeriod, periodsElapsed);
}

// Days remaining until maturity, floored at 0 (never negative — a matured FD
// just reads "matured" rather than a negative countdown).
export function daysUntilMaturity(maturityDate: Date, now: Date = new Date()): number {
  const ms = maturityDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
