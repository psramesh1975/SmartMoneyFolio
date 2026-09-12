import { Wallet, ArrowLeftRight, Gauge, Scale, CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";
import { ratioTone } from "@/lib/dashboard-data";
import type { DashboardHeadlineKPIs } from "@/lib/dashboard-data";

function cashFlowTone(netCashFlow: number) {
  if (netCashFlow > 0) return "text-emerald-600 dark:text-cyan-400";
  if (netCashFlow < 0) return "text-rose-600 dark:text-rose-400";
  return "text-slate-900 dark:text-white";
}

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40";
const labelClass =
  "text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";
const iconWrapClass = (border: string, bg: string, text: string) =>
  `rounded-xl border ${border} ${bg} p-2 ${text}`;

export default function SolvencyKPIRow({ kpis }: { kpis: DashboardHeadlineKPIs }) {
  const { baseCurrency, liquidBuffer, netCashFlow, financialRunway, netWorth, debtToAssetRatio } = kpis;

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {/* 1. Liquid Buffer */}
      <div className={cardClass}>
        <div className="flex items-start justify-between">
          <span className={labelClass}>Liquid buffer</span>
          <div className={iconWrapClass("border-emerald-100 dark:border-cyan-500/20", "bg-emerald-50 dark:bg-emerald-500/10", "text-emerald-600 dark:text-cyan-400")}>
            <Wallet size={16} />
          </div>
        </div>
        <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {formatCurrency(liquidBuffer, baseCurrency)}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cash + Fixed Deposits</p>
      </div>

      {/* 2. Monthly Cash Flow */}
      <div className={cardClass}>
        <div className="flex items-start justify-between">
          <span className={labelClass}>Monthly cash flow</span>
          <div className={iconWrapClass("border-blue-100 dark:border-lime-400/20", "bg-blue-50 dark:bg-blue-500/10", "text-blue-600 dark:text-lime-400")}>
            <ArrowLeftRight size={16} />
          </div>
        </div>
        <p className={`mt-1 text-2xl font-black tracking-tight ${cashFlowTone(netCashFlow)}`}>
          {formatCurrency(netCashFlow, baseCurrency)}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current month, income − outflow</p>
      </div>

      {/* 3. Financial Runway */}
      <div className={cardClass}>
        <div className="flex items-start justify-between">
          <span className={labelClass}>Financial runway</span>
          <div className={iconWrapClass("border-indigo-100 dark:border-indigo-400/20", "bg-indigo-50 dark:bg-indigo-500/10", "text-indigo-600 dark:text-indigo-400")}>
            <Gauge size={16} />
          </div>
        </div>
        <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {financialRunway !== null ? `${financialRunway.toFixed(1)} Months` : "—"}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {financialRunway !== null
            ? "Based on 3-month avg actual outflow"
            : "Not enough Monthly Tracking history yet"}
        </p>
      </div>

      {/* 4. Net Worth — label text and data-testid must be preserved exactly;
          tests/balance-sheet.spec.ts locates "Net worth" by text and reads
          the following sibling. Keep the span → icon-div sibling order
          identical to the original markup. */}
      <div className={cardClass}>
        <div className="flex items-start justify-between">
          <span className={labelClass}>Net worth</span>
          <div className={iconWrapClass("border-blue-100 dark:border-lime-400/20", "bg-blue-50 dark:bg-blue-500/10", "text-blue-600 dark:text-lime-400")}>
            <Scale size={16} />
          </div>
        </div>
        <p
          data-testid="net-worth-value"
          className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white"
        >
          {formatCurrency(netWorth, baseCurrency)}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total assets − total liabilities</p>
      </div>

      {/* 5. Debt-to-Asset Ratio */}
      <div className={cardClass}>
        <div className="flex items-start justify-between">
          <span className={labelClass}>Debt-to-asset ratio</span>
          <div className={iconWrapClass("border-rose-100 dark:border-rose-400/20", "bg-rose-50 dark:bg-rose-500/10", "text-rose-600 dark:text-rose-400")}>
            <CreditCard size={16} />
          </div>
        </div>
        <p className={`mt-1 text-2xl font-black tracking-tight ${ratioTone(debtToAssetRatio)}`}>
          {debtToAssetRatio.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
