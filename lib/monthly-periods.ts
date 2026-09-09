// Everything else in the monthly tracker depends on this being consistent,
// so period math is centralized here. Nothing is ever physically rolled over
// at year-end — Previous/Current/Next/Earlier are all computed live from
// today's date, in the household's own timezone, each time a page loads.
//
// Built on Intl.DateTimeFormat rather than a date library: formatting "now"
// into a specific IANA zone and reading back its year/month is enough to get
// a timezone-correct calendar date without pulling in date-fns-tz — Node's
// built-in Intl already knows the DST/offset rules for every zone.

export type Period = { year: number; month: number }; // month is 1-12

export function getHouseholdToday(timeZone: string): Period {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

export function getCurrentPeriod(timeZone: string): Period {
  return getHouseholdToday(timeZone);
}

export function getPreviousPeriod(timeZone: string): Period {
  const { year, month } = getCurrentPeriod(timeZone);
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function getNextPeriod(timeZone: string): Period {
  const { year, month } = getCurrentPeriod(timeZone);
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

// Months in the *current* calendar year that are already fully in the past
// (before Previous Month), shown read-only on the "Earlier Months" page.
// Empty in January, since Previous Month itself falls in the prior year then.
export function getEarlierMonthsOfCurrentYear(timeZone: string): Period[] {
  const { year: curYear } = getCurrentPeriod(timeZone);
  const prev = getPreviousPeriod(timeZone);
  if (prev.year !== curYear) return [];
  const months: Period[] = [];
  for (let m = 1; m < prev.month; m++) months.push({ year: curYear, month: m });
  return months;
}

// Years fully archived to "Earlier Years". A year only counts as archived once
// its December is no longer reachable via "Previous Month" — i.e. normally
// every year before the current one, except in January, when last year's
// December is still the (editable) Previous Month.
//
// Note: this is deliberately unaffected by the "current month >= October"
// rule that gates a separate, not-yet-built "start planning next year"
// affordance — that rule is about offering a new upcoming year for setup,
// not about when a past year becomes archived here.
export function getMostRecentArchivedYear(timeZone: string): number {
  const { year: curYear, month: curMonth } = getCurrentPeriod(timeZone);
  return curMonth === 1 ? curYear - 2 : curYear - 1;
}

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_LABELS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
