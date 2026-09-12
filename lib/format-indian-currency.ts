// lib/format-indian-currency.ts
// Formats a number using the Indian numbering system (lakh/crore grouping)
// with a ₹ symbol, matching the approved dashboard mockup exactly:
// ₹26,38,99,337 (no decimals for whole-rupee amounts).
//
// Scoped to the Dashboard route only (see formatDashboardAmount() in
// lib/dashboard-data.ts) — NOT wired into the app-wide lib/format-currency.ts,
// since this app is multi-currency by design (households can hold AED/USD
// alongside INR) and formatCurrency()'s existing "CODE 1,234.56" output is
// asserted on literally by tests/monthly-base.spec.ts's CURRENCY_TOKEN regex.
// Swapping that shared formatter's output shape is a bigger, separate change
// for when those other pages get their own mockup pass.
//
// Usage:
//   formatINR(263899337)        -> "₹26,38,99,337"
//   formatINR(50500000)         -> "₹5,05,00,000"
//   formatINR(1111111.5)        -> "₹11,11,112"   (rounds to nearest rupee)
//   formatINR(1111111.5, true)  -> "₹11,11,111.50" (keep 2 decimals)

export function formatINR(value: number, showDecimals = false): string {
  const isNegative = value < 0;
  const abs = Math.abs(value);

  const fixed = showDecimals ? abs.toFixed(2) : Math.round(abs).toString();
  const [intPart, decimalPart] = fixed.split(".");

  // Indian grouping: last 3 digits, then groups of 2
  const lastThree = intPart.slice(-3);
  const otherDigits = intPart.slice(0, -3);
  const grouped = otherDigits
    ? otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
    : lastThree;

  const sign = isNegative ? "-" : "";
  const decimals = showDecimals ? `.${decimalPart}` : "";

  return `${sign}₹${grouped}${decimals}`;
}

// Compact form for smaller UI spots (e.g. "₹21.2 Cr", "₹11.1L") matching the
// legend style in "Macro Allocation: What We Own" and the sidebar's
// "Goals (₹6 Cr Target)" nav label.
export function formatINRCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(abs % 1_00_00_000 === 0 ? 0 : 1)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(abs % 1_00_000 === 0 ? 0 : 1)}L`;
  }
  return formatINR(value);
}
