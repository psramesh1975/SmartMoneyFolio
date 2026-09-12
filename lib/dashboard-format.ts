import { formatCurrency } from "@/lib/format-currency";
import { formatINR } from "@/lib/format-indian-currency";

// The Dashboard route's own amount formatter — every rupee figure shown on
// /dashboard goes through this, per the approved mockup, which renders whole
// INR amounts as "₹26,38,99,337" (Indian lakh/crore grouping, no decimals)
// rather than the app-wide formatCurrency()'s "INR 26,38,99,337.00". Other
// currencies (a household's AED/USD holdings) fall back to formatCurrency()
// unchanged, since formatINR() only knows how to render rupees.
export function formatDashboardAmount(amount: number | string, currencyCode: string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (currencyCode === "INR") return formatINR(n);
  return formatCurrency(n, currencyCode);
}
