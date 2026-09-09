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

// Same values as AssetClassValue, shaped for z.enum() — the one place the
// enum's literal values are spelled out, so the import routes (and anything
// else validating a raw asset-class string) derive from this instead of
// re-typing the list.
export const ASSET_CLASS_VALUES = ASSET_CLASSES.map((c) => c.value) as [
  AssetClassValue,
  ...AssetClassValue[],
];

export function assetClassLabel(value: string): string {
  return ASSET_CLASSES.find((a) => a.value === value)?.label ?? value;
}
