// Macro Allocation's exact 4 buckets + colors, per the approved mockup —
// deliberately a THIRD asset categorization (distinct from
// lib/asset-classes.ts's ASSET_GROUPS, still used by AssetsClient.tsx's own
// grouped view on /assets, and lib/asset-categories.ts's 7-category /assets
// accordion, final per the Phase 9 spec). "Other" isn't in the mockup — it's
// a fallback for classes the mockup's 4 buckets don't name (SGB, Gold,
// Retirement, Insurance, Government Scheme, Real Estate, Crypto), so a
// household holding any of those doesn't have its total silently undercount
// what these 4 segments + legend show.
//
// Pulled out of app/(app)/dashboard/page.tsx (originally the only consumer)
// so the dashboard's chart widgets — AssetDistributionDonut and
// MemberAllocationStackedBar — can share this exact same bucket/color
// mapping instead of each inventing its own, keeping every chart on the
// dashboard agreeing about what "Fixed Deposits" (etc.) means and looks like.
export const MACRO_ALLOCATION_GROUPS: { label: string; classes: string[]; color: string }[] = [
  { label: "Fixed Deposits", classes: ["FIXED_DEPOSIT"], color: "bg-purple-600" },
  { label: "Equities & Stocks", classes: ["STOCKS"], color: "bg-blue-600" },
  { label: "Mutual Funds", classes: ["MUTUAL_FUNDS"], color: "bg-pink-500" },
  { label: "Liquid Cash & Bonds", classes: ["CASH", "BONDS"], color: "bg-amber-500" },
  {
    label: "Other",
    classes: ["SGB", "GOLD", "RETIREMENT_SAVINGS", "INSURANCE_LINKED", "GOVERNMENT_SCHEME", "REAL_ESTATE", "CRYPTOCURRENCY", "OTHER"],
    color: "bg-slate-400",
  },
];

// Hex equivalents of the Tailwind classes above, for Chart.js canvases —
// Chart.js draws to a <canvas>, so it needs real colors, not Tailwind class
// strings. Keys must stay in sync with MACRO_ALLOCATION_GROUPS' `color`
// values. Dark-mode variants are the same accent hue lifted a shade lighter,
// matching the light/dark swap convention used by CategoryBreakupDonut.
export const MACRO_GROUP_COLOR_HEX: Record<string, { light: string; dark: string }> = {
  "bg-purple-600": { light: "#9333ea", dark: "#a855f7" },
  "bg-blue-600": { light: "#2563eb", dark: "#60a5fa" },
  "bg-pink-500": { light: "#ec4899", dark: "#f472b6" },
  "bg-amber-500": { light: "#f59e0b", dark: "#fbbf24" },
  "bg-slate-400": { light: "#94a3b8", dark: "#94a3b8" },
};

export function macroGroupColorHex(colorClass: string, isDark: boolean): string {
  const hex = MACRO_GROUP_COLOR_HEX[colorClass];
  if (!hex) return isDark ? "#94a3b8" : "#94a3b8";
  return isDark ? hex.dark : hex.light;
}

export function formatMacroPercent(pct: number): string {
  if (pct > 0 && pct < 0.1) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}
