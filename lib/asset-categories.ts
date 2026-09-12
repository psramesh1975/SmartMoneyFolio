import type { AssetClassValue } from "@/lib/asset-classes";

// Groups the asset classes into the 7 accordion sections on /assets. Distinct
// from lib/asset-classes.ts's ASSET_GROUPS (currently unused — see its own
// comment) — this one carries the icon/subtitle metadata the full Assets
// page needs.
export const ASSET_CATEGORIES: {
  id: string;
  label: string;
  subtitle: string;
  icon: string; // lucide-react component name
  classes: AssetClassValue[];
}[] = [
  { id: "fixed-deposits", label: "Fixed & Term Deposits", subtitle: "Guaranteed bank term deposits", icon: "Landmark", classes: ["FIXED_DEPOSIT"] },
  { id: "market", label: "Mutual Funds & Stocks", subtitle: "Equity and debt market investments", icon: "TrendingUp", classes: ["MUTUAL_FUNDS", "STOCKS"] },
  { id: "sgb", label: "Sovereign Gold Bonds", subtitle: "RBI gold bonds with semi-annual coupon", icon: "Coins", classes: ["SGB"] },
  { id: "pension", label: "Pension & Insurance", subtitle: "Long-term annuity and locked reserves", icon: "ShieldCheck", classes: ["RETIREMENT_SAVINGS", "INSURANCE_LINKED"] },
  { id: "liquid", label: "Liquid Cash & Banking", subtitle: "Checking, savings, NRE/NRO balances", icon: "Wallet", classes: ["CASH"] },
  { id: "real-estate", label: "Real Estate", subtitle: "Property and land holdings", icon: "Home", classes: ["REAL_ESTATE"] },
  { id: "other", label: "Government Schemes & Other", subtitle: "PPF, SSA, crypto, and everything else", icon: "Layers", classes: ["GOVERNMENT_SCHEME", "GOLD", "BONDS", "CRYPTOCURRENCY", "OTHER"] },
];

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export function categoryForAssetClass(assetClass: string): AssetCategory | undefined {
  return ASSET_CATEGORIES.find((c) => (c.classes as string[]).includes(assetClass));
}
