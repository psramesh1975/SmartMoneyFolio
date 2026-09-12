import { formatCurrency } from "@/lib/format-currency";
import type { DashboardHeadlineKPIs } from "@/lib/dashboard-data";

// Restored per the approved mockup (gemini-code-1789190462523-.html): 4
// cards — Total Assets, Total Liabilities, Net Worth, Debt-to-Asset Ratio —
// replacing the Phase 8 5-card row (Liquid Buffer / Monthly Cash Flow /
// Financial Runway / Net Worth / Debt-to-Asset Ratio). Liquid Buffer and
// Financial Runway move to the Right Rail's EmergencyRunwayCard; Monthly
// Cash Flow's underlying figure (netCashFlow) is repurposed below as Net
// Worth's "accrued this month" subtext instead of its own card, matching
// the mockup exactly. Icons are literal emoji glyphs, not lucide-react —
// the mockup uses emoji here specifically, unlike the rest of the app.
const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card";
const labelRowClass =
  "flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500";
const iconBadgeClass = (bg: string, text: string) =>
  `flex h-7 w-7 items-center justify-center rounded-lg font-bold ${bg} ${text}`;

// Matches the mockup's stated threshold exactly ("Threshold: <30%").
const DEBT_HEALTHY_THRESHOLD = 30;

function accrualLine(netCashFlow: number, baseCurrency: string) {
  if (netCashFlow > 0) {
    return { text: `+${formatCurrency(netCashFlow, baseCurrency)} accrued this month`, tone: "text-emerald-600 dark:text-cyan-400" };
  }
  if (netCashFlow < 0) {
    return { text: `${formatCurrency(netCashFlow, baseCurrency)} this month`, tone: "text-rose-600 dark:text-rose-400" };
  }
  return { text: "No change this month", tone: "text-slate-500 dark:text-slate-400" };
}

export default function SolvencyKPIRow({
  kpis,
  memberCount,
}: {
  kpis: DashboardHeadlineKPIs;
  memberCount: number;
}) {
  const { baseCurrency, totalAssets, totalLiabilities, netWorth, netCashFlow, debtToAssetRatio } = kpis;
  const accrual = accrualLine(netCashFlow, baseCurrency);
  const isHealthy = debtToAssetRatio < DEBT_HEALTHY_THRESHOLD;

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Assets */}
      <div className={cardClass}>
        <div className={labelRowClass}>
          <span>Total Assets</span>
          <div className={iconBadgeClass("bg-emerald-50 dark:bg-emerald-500/10", "text-emerald-600 dark:text-cyan-400")}>🏛️</div>
        </div>
        <p className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-cyan-400">
          {formatCurrency(totalAssets, baseCurrency)}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Across {memberCount} family portfolio{memberCount === 1 ? "" : "s"}
        </p>
      </div>

      {/* 2. Total Liabilities */}
      <div className={cardClass}>
        <div className={labelRowClass}>
          <span>Total Liabilities</span>
          <div className={iconBadgeClass("bg-rose-50 dark:bg-rose-500/10", "text-rose-600 dark:text-rose-400")}>💳</div>
        </div>
        <p className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
          {formatCurrency(totalLiabilities, baseCurrency)}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Home loan &amp; active obligations</p>
      </div>

      {/* 3. Net Worth — label text and data-testid must be preserved exactly;
          tests/balance-sheet.spec.ts locates "Net worth" by text and reads
          the following sibling. */}
      <div className={`${cardClass} ring-1 ring-emerald-500/20`}>
        <div className={labelRowClass}>
          <span>Net worth</span>
          <div className={iconBadgeClass("bg-indigo-50 dark:bg-indigo-500/10", "text-indigo-600 dark:text-indigo-400")}>⚖️</div>
        </div>
        <p
          data-testid="net-worth-value"
          className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white"
        >
          {formatCurrency(netWorth, baseCurrency)}
        </p>
        <p className={`mt-1 text-xs font-semibold ${accrual.tone}`}>{accrual.text}</p>
      </div>

      {/* 4. Debt-to-Asset Ratio */}
      <div className={cardClass}>
        <div className={labelRowClass}>
          <span>Debt-to-Asset Ratio</span>
          <div className={iconBadgeClass("bg-teal-50 dark:bg-teal-500/10", "text-teal-600 dark:text-teal-400")}>🧭</div>
        </div>
        <p className="mt-2 text-2xl font-extrabold text-teal-600 dark:text-teal-400">{debtToAssetRatio.toFixed(1)}%</p>
        <p
          className={`mt-1 text-xs font-semibold ${
            isHealthy ? "text-emerald-600 dark:text-cyan-400" : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {isHealthy
            ? `✓ Healthy (Threshold: <${DEBT_HEALTHY_THRESHOLD}%)`
            : `⚠ Elevated (Threshold: <${DEBT_HEALTHY_THRESHOLD}%)`}
        </p>
      </div>
    </div>
  );
}
