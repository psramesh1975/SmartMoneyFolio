// Shared shapes for the three Excel bulk-importers (Accounts, Goals,
// AllocationTarget). See components/ImportExcelModal.tsx for the shared UI
// and app/api/*/import/{validate,route}.ts for the resource-specific servers.

export type ImportMode = "append" | "replace";

export type ValidateRowResult = {
  row: number; // 1-based spreadsheet row, header counted as row 1
  status: "ok" | "error";
  summary?: string; // human-readable preview, present when status === "ok"
  error?: string; // present when status === "error"
  data?: Record<string, unknown>; // validated payload to resend at commit time, present when ok
};

export type ValidateResponse = {
  rows: ValidateRowResult[];
  validCount: number;
  errorCount: number;
  warning?: string | null; // non-blocking, e.g. Targets sum-to-100 check
};
