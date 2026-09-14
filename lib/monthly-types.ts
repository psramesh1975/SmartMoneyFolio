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
  // Day-of-month (1-31) this one-off entry is expected to fall on — see
  // MonthlyEntry.scheduledDay in the schema. Null for ordinary one-offs;
  // set for Forward Simulation "Advance Entry" rows.
  scheduledDay: number | null;
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
  // The linked Liability.id (EMI) / Account.id (SIP) — powers the
  // Source/Sync column's "Liabilities ↗" / "Assets ↗" link. Null if the
  // linked record is somehow missing (line item survived a broken
  // relation) — the Source/Sync column falls back to plain text then.
  sourceId: string | null;
  // Liability.emiDueDay / Account.sipDueDay — day-of-month (1-31), null if
  // not set. Powers the Schedule column ("10th of Month").
  dueDay: number | null;
};

// Manual row — Income or Expense, both share this shape. `categoryId` is
// fixed at creation (no category-switch-on-row, same as before); scheduleDay
// / paymentMethod are nullable everywhere — an existing row with neither set
// simply renders "—" in those columns.
export type MonthlyBaseGeneralRowDTO = {
  id: string;
  name: string;
  baseAmount: string;
  categoryId: string;
  scheduleDay: number | null;
  paymentMethod: string | null;
};

export type MonthlyBaseKpisDTO = {
  totalIncome: string;
  totalOutflow: string;
  debtServicing: string; // EMI rows total
  sipContributions: string; // SIP rows total
  wealthBuilding: string; // debtServicing + sipContributions
  wealthBuildingPercent: number; // 0-100 of totalOutflow, 0 when totalOutflow is 0
  fixedLiving: string; // totalOutflow - wealthBuilding
  fixedLivingPercent: number;
  netBuffer: string; // totalIncome - totalOutflow — can be negative
  netBufferPercent: number; // % of totalIncome — can be negative, 0 when totalIncome is 0
};

export type FlatBasePayload = {
  incomeRows: MonthlyBaseGeneralRowDTO[];
  expenseRows: MonthlyBaseGeneralRowDTO[];
  debtRows: MonthlyBaseAutoRowDTO[];
  sipRows: MonthlyBaseAutoRowDTO[];
  incomeCategories: MonthlyCategoryOptionDTO[];
  expenseCategories: MonthlyCategoryOptionDTO[];
  categories: MonthlyCategoryOptionDTO[]; // both types combined — for ManageCategoriesPanel only
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
