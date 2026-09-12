"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import MemberFilterSelect from "@/components/dashboard/MemberFilterSelect";
import { useMobileNav } from "@/components/MobileNavContext";
import type { MarketTicker } from "@/lib/market-ticker";

function pctBadge(pct: number | null) {
  if (pct === null) return { text: "—", tone: "text-slate-400 dark:text-slate-500" };
  const up = pct >= 0;
  return {
    text: `${up ? "+" : ""}${pct.toFixed(2)}% ${up ? "▲" : "▼"}`,
    tone: up ? "text-emerald-600 dark:text-cyan-400" : "text-rose-600 dark:text-rose-400",
  };
}

function priceText(price: number | null, digits = 2) {
  if (price === null) return "—";
  return price.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function AppHeader({
  baseCurrency,
  familyMembers,
  marketTicker,
  lastUpdatedAt,
}: {
  baseCurrency: string;
  familyMembers: { id: string; name: string; relationship: string }[];
  marketTicker: MarketTicker;
  lastUpdatedAt: Date | null;
}) {
  const { toggle, isOpen } = useMobileNav();
  const nifty = pctBadge(marketTicker.niftyChangePct);
  const sensex = pctBadge(marketTicker.sensexChangePct);

  return (
    <header className="border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-canvas-card">
      {/* Live market ticker strip — see lib/market-ticker.ts for sourcing.
          Every figure renders "—" instead of a guess when its upstream is
          unavailable, rather than ever showing a stale/fabricated number. */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 bg-slate-50 px-4 py-2 text-xs dark:border-slate-800/60 dark:bg-white/5 sm:px-8">
        <div className="scrollbar-none flex items-center gap-6 overflow-x-auto font-medium">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Markets
          </span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-bold text-slate-800 dark:text-slate-200">NIFTY 50:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">{priceText(marketTicker.niftyPrice)}</span>
            <span className={`text-[11px] font-bold ${nifty.tone}`}>{nifty.text}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-bold text-slate-800 dark:text-slate-200">SENSEX:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">{priceText(marketTicker.sensexPrice)}</span>
            <span className={`text-[11px] font-bold ${sensex.tone}`}>{sensex.text}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-bold text-slate-800 dark:text-slate-200">GOLD (24K/10g, est.):</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {marketTicker.gold24kPer10g === null ? "—" : `₹${marketTicker.gold24kPer10g.toLocaleString("en-IN")}`}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-bold text-slate-800 dark:text-slate-200">RBI REPO:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">{marketTicker.repoRatePct.toFixed(2)}%</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/monthly/current"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-400 dark:hover:bg-cyan-500/20"
          >
            + Log Record
          </Link>
          <LogoutButton className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" />
        </div>
      </div>

      {/* Main action bar */}
      <div className="flex flex-col items-start justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label="Open navigation menu"
            aria-expanded={isOpen}
            className="inline-flex items-center justify-center rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 md:hidden"
          >
            <Menu size={20} />
          </button>
          <Suspense fallback={<div className="h-[38px] w-56 rounded-xl border border-slate-200 dark:border-slate-800" />}>
            <MemberFilterSelect members={familyMembers} />
          </Suspense>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
            Base Currency: {baseCurrency}
          </span>
        </div>

        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Last updated:{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {lastUpdatedAt
              ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(lastUpdatedAt)
              : "Not yet synced"}
          </span>{" "}
          (latest security price sync)
        </div>
      </div>
    </header>
  );
}
