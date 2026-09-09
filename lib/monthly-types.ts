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

export type MonthlyCategoryDTO = {
  id: string;
  name: string;
  type: MonthlyCategoryTypeValue;
  sortOrder: number;
  entries: MonthlyEntryDTO[];
};

// --- Monthly Base (the setup page) ---

export type MonthlyLineItemDTO = {
  id: string;
  categoryId: string;
  name: string;
  baseAmount: string;
  repeatMonths: number[];
  isActive: boolean;
};

export type MonthlyBaseCategoryDTO = {
  id: string;
  name: string;
  type: MonthlyCategoryTypeValue;
  sortOrder: number;
  lineItems: MonthlyLineItemDTO[];
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
