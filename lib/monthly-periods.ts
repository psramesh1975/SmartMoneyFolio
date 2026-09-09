// Everything else in the monthly tracker depends on this being consistent,
// so period math is centralized here. Nothing is ever physically rolled over
// at year-end — Previous/Current/Next/Earlier are all computed live from
// today's date each time a page loads.

export type Period = { year: number; month: number }; // month is 1-12

export function getCurrentPeriod(): Period {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getPreviousPeriod(): Period {
  const { year, month } = getCurrentPeriod();
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function getNextPeriod(): Period {
  const { year, month } = getCurrentPeriod();
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

// Months in the *current* calendar year that are already fully in the past
// (before Previous Month), shown read-only on the "Earlier Months" page.
// Empty in January, since Previous Month itself falls in the prior year then.
export function getEarlierMonthsOfCurrentYear(): Period[] {
  const { year: curYear } = getCurrentPeriod();
  const prev = getPreviousPeriod();
  if (prev.year !== curYear) return [];
  const months: Period[] = [];
  for (let m = 1; m < prev.month; m++) months.push({ year: curYear, month: m });
  return months;
}

// Years fully archived to "Earlier Years". A year only counts as archived once
// its December is no longer reachable via "Previous Month" — i.e. normally
// every year before the current one, except in January, when last year's
// December is still the (editable) Previous Month.
export function getMostRecentArchivedYear(): number {
  const { year: curYear, month: curMonth } = getCurrentPeriod();
  return curMonth === 1 ? curYear - 2 : curYear - 1;
}

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
