export const ASSET_CLASSES = [
  { value: "CASH", label: "Cash / Bank Balance" },
  { value: "FIXED_DEPOSIT", label: "Fixed Deposit / Time Deposit" },
  { value: "STOCKS", label: "Stocks / Equities" },
  { value: "MUTUAL_FUNDS", label: "Mutual Funds / ETFs" },
  { value: "BONDS", label: "Bonds" },
  { value: "GOLD", label: "Gold / Precious Metals" },
  { value: "SGB", label: "Sovereign Gold Bonds" },
  { value: "RETIREMENT_SAVINGS", label: "Retirement / Long-term Savings" },
  { value: "INSURANCE_LINKED", label: "Insurance-linked Investment" },
  { value: "GOVERNMENT_SCHEME", label: "Government Scheme (PPF / SSA / NPS)" },
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

// Grouped asset classes — previously drove the dashboard's own Assets area
// (AssetsOverview.tsx) before that section was retired in the dashboard
// visual revamp; currently unused, kept in case a similar grouped view is
// needed again. holdingName free text already covers sub-labels like
// "HDFC", "Emirates NBD", "SBI Life" — no schema change needed there, it's
// just what the user types into the existing name field.
export const ASSET_GROUPS: { label: string; classes: AssetClassValue[] }[] = [
  { label: "Liquid Cash & Banking", classes: ["CASH"] },
  { label: "Market Investments", classes: ["STOCKS", "MUTUAL_FUNDS", "BONDS", "CRYPTOCURRENCY"] },
  { label: "Fixed Capital & Guaranteed", classes: ["FIXED_DEPOSIT", "GOLD", "SGB"] },
  { label: "Retirement & Locked Funds", classes: ["RETIREMENT_SAVINGS", "INSURANCE_LINKED", "GOVERNMENT_SCHEME"] },
  { label: "Physical Assets / Real Estate", classes: ["REAL_ESTATE"] },
  { label: "Other", classes: ["OTHER"] },
];
