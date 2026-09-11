import type { MonthlySummary } from "@/lib/monthly-summary";

export type MonthlyCategoryTypeValue = "INCOME" | "OUTFLOW";

// Decimal fields are serialized as strings (same convention as Goal/Account),
// parsed with Number(...) on the client where needed for math or display.
export type MonthlyEntryDTO = {
  id: string;
  categoryId: string;
  lineItemId: string | null;
  name: string;
  // Reference snapshot from the line item at generation time (or == plannedAmount
  // for a one-off, which has no separate "base"). Shown, never directly editable.
  baseAmount: string;
  // This month's actual plan — defaults to baseAmount at generation, freely
  // editable from here on without touching the line item or other months.
  plannedAmount: string;
  actualAmount: string | null;
  isSkipped: boolean;
  notes: string | null;
  // Present only when lineItemId is set — the recurring line's own current
  // settings, used to pre-fill the "edit recurring line" control.
  lineItem: {
    id: string;
    baseAmount: string;
    repeatMonths: number[];
    isActive: boolean;
  } | null;
};

export type MonthlyCategorySpendKindValue = "FIXED" | "VARIABLE";

export type MonthlyCategoryDTO = {
  id: string;
  name: string;
  type: MonthlyCategoryTypeValue;
  sortOrder: number;
  spendKind: MonthlyCategorySpendKindValue | null;
  isSubscription: boolean;
  entries: MonthlyEntryDTO[];
};

// --- Monthly Base (the setup page): auto-linked EMI/SIP rows (read-only,
// sourced from Liabilities/Assets by lib/monthly-auto-sync.ts) plus general
// recurring expenses, grouped by category and freely editable.

export type MonthlyBaseAutoRowDTO = {
  id: string;
  name: string;
  baseAmount: string;
  // Debt rows: the liability's accountReference for the subtitle line.
  // SIP rows: the account's accountOrFolioNo for the subtitle line.
  subtitle: string | null;
  kind: "EMI" | "SIP";
};

export type MonthlyBaseGeneralRowDTO = {
  id: string;
  name: string;
  baseAmount: string;
  categoryId: string;
};

export type MonthlyBaseCategoryGroupDTO = {
  categoryId: string;
  categoryName: string;
  rows: MonthlyBaseGeneralRowDTO[];
};

export type MonthlyBaseKpisDTO = {
  totalOutflow: string;
  debtServicing: string; // EMI rows total
  sipContributions: string; // SIP rows total
  wealthBuilding: string; // debtServicing + sipContributions
  wealthBuildingPercent: number; // 0-100, 0 when totalOutflow is 0
  fixedLiving: string; // totalOutflow - wealthBuilding
  fixedLivingPercent: number;
};

export type FlatBasePayload = {
  debtRows: MonthlyBaseAutoRowDTO[];
  sipRows: MonthlyBaseAutoRowDTO[];
  generalGroups: MonthlyBaseCategoryGroupDTO[];
  categories: MonthlyCategoryOptionDTO[]; // for the "add row" category picker — excludes the two system categories
  kpis: MonthlyBaseKpisDTO;
};

export type MonthlyCategoryOptionDTO = {
  id: string;
  name: string;
  type: MonthlyCategoryTypeValue;
  spendKind: MonthlyCategorySpendKindValue | null;
  isSubscription: boolean;
};

export type MonthlyMonthPayload = {
  year: number;
  month: number;
  categories: MonthlyCategoryDTO[];
  summary: MonthlySummary;
};

// Read-only: a full archived year, month-by-month, plus a whole-year total.
// Categories with no entries in a given month are omitted from that month's
// list (this view is a locked history, not an editing surface).
export type MonthlyYearPayload = {
  year: number;
  months: MonthlyMonthPayload[];
  yearlySummary: MonthlySummary;
};
