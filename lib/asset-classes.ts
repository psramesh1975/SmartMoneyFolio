export const ASSET_CLASSES = [
  { value: "CASH", label: "Cash / Bank Balance" },
  { value: "FIXED_DEPOSIT", label: "Fixed Deposit / Time Deposit" },
  { value: "STOCKS", label: "Stocks / Equities" },
  { value: "MUTUAL_FUNDS", label: "Mutual Funds / ETFs" },
  { value: "BONDS", label: "Bonds" },
  { value: "GOLD", label: "Gold / Precious Metals" },
  { value: "RETIREMENT_SAVINGS", label: "Retirement / Long-term Savings" },
  { value: "INSURANCE_LINKED", label: "Insurance-linked Investment" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "CRYPTOCURRENCY", label: "Cryptocurrency" },
  { value: "OTHER", label: "Other" },
] as const;

export type AssetClassValue = (typeof ASSET_CLASSES)[number]["value"];

export function assetClassLabel(value: string): string {
  return ASSET_CLASSES.find((a) => a.value === value)?.label ?? value;
}
