// Matches the "CODE 1,234" convention already used in AssetsClient.tsx,
// extended to 2 decimals for Monthly Base's KPI pills and row amounts.
// Household's baseCurrency, not hardcoded — this app is multi-currency by
// design.
export function formatCurrency(amount: number | string, currencyCode: string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n === 0) return "-";
  return `${currencyCode} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
