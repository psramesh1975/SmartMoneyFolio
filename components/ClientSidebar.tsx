"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LayoutDashboard, Target, Landmark, CreditCard, Settings as SettingsIcon } from "lucide-react";
import { useMobileNav } from "@/components/MobileNavContext";

export default function ClientSidebar({
  isPlatformOwner,
  householdName,
  previousLabel,
  currentLabel,
  nextLabel,
  goalTargetLabel,
  baseCurrency,
}: {
  isPlatformOwner: boolean;
  householdName: string;
  previousLabel: string;
  currentLabel: string;
  nextLabel: string;
  // e.g. "₹6 Cr" — the primary goal's target amount, compact-formatted by
  // the caller (app/(app)/layout.tsx); null when the household has no goals
  // yet, in which case the nav item drops the "(... Target)" suffix rather
  // than showing a placeholder figure.
  goalTargetLabel: string | null;
  baseCurrency: string;
}) {
  const pathname = usePathname(); // still needed for per-link active highlighting
  const { isOpen, close } = useMobileNav();

  // Default false on first render to avoid a hydration mismatch, then sync
  // from localStorage after mount — same pattern as ThemeToggle and the
  // Phase 7 breakdown panel. Driven purely by the manual toggle — no
  // route-based override, so it can be collapsed even while on a
  // /monthly/* page.
  const [monthlyExpanded, setMonthlyExpanded] = useState(false);
  useEffect(() => {
    setMonthlyExpanded(localStorage.getItem("smf-sidebar-monthly-open") === "true");
  }, []);

  // The mobile drawer shouldn't survive a navigation — close it whenever the
  // path changes. Deliberately depends on `pathname` alone, not `close`
  // (whose identity from context isn't memoized): this should fire once per
  // route change, not once per render.
  useEffect(() => {
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleMonthly() {
    const next = !monthlyExpanded;
    setMonthlyExpanded(next);
    localStorage.setItem("smf-sidebar-monthly-open", String(next));
  }

  const linkClass = (href: string) =>
    `block px-3 py-2 text-sm ${
      pathname === href ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`;

  // Current Month gets a distinct emerald badge instead of the plain
  // active-link highlight, so it reads as "you are here" at a glance even
  // when the group is collapsed and re-opened.
  const currentMonthActive = pathname === "/monthly/current";
  const currentMonthClass = currentMonthActive
    ? "flex items-center justify-between py-2 px-2 text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
    : `${linkClass("/monthly/current")} flex items-center justify-between`;

  // Shared between the always-visible desktop <aside> and the mobile
  // drawer, so the nav markup isn't duplicated. Called as a plain function
  // rather than rendered as a JSX component tag, so it doesn't get treated
  // as a new component type (and remounted) on every render.
  const iconLinkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2 text-sm ${
      pathname === href ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`;

  function renderNavContent(onNavigate?: () => void) {
    return (
      <>
        <div className="px-4 py-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Wealth OS</span>
          <Link href="/dashboard" className="block text-base font-extrabold text-white" onClick={onNavigate}>
            Smart Money Folio
          </Link>
          <p className="mt-0.5 text-xs text-slate-400">{householdName}</p>
        </div>
        <nav className="px-2">
          <Link href="/dashboard" className={iconLinkClass("/dashboard")} onClick={onNavigate}>
            <LayoutDashboard size={16} className="shrink-0" />
            Dashboard
          </Link>
          <Link href="/goals" className={iconLinkClass("/goals")} onClick={onNavigate}>
            <Target size={16} className="shrink-0" />
            Goals{goalTargetLabel ? ` (${goalTargetLabel} Target)` : ""}
          </Link>
          <Link href="/assets" className={iconLinkClass("/assets")} onClick={onNavigate}>
            <Landmark size={16} className="shrink-0" />
            Assets &amp; Holdings
          </Link>
          <Link href="/liabilities" className={iconLinkClass("/liabilities")} onClick={onNavigate}>
            <CreditCard size={16} className="shrink-0" />
            Liabilities &amp; Loans
          </Link>
          <button
            type="button"
            onClick={toggleMonthly}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            aria-expanded={monthlyExpanded}
          >
            <span>Monthly Tracking</span>
            <ChevronRight size={16} className={`w-4 h-4 shrink-0 transition-transform ${monthlyExpanded ? "rotate-90" : ""}`} />
          </button>

          {monthlyExpanded && (
            <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
              <Link href="/monthly/base" className={linkClass("/monthly/base")} onClick={onNavigate}>
                Monthly Base
              </Link>
              <Link
                href="/monthly/previous"
                className={`${linkClass("/monthly/previous")} flex items-center justify-between`}
                onClick={onNavigate}
              >
                <span>Previous Month</span>
                <span className="text-xs opacity-70">{previousLabel}</span>
              </Link>
              <Link href="/monthly/current" className={currentMonthClass} onClick={onNavigate}>
                <span>Current Month</span>
                <span className="font-mono text-[10px] opacity-90">{currentLabel}</span>
              </Link>
              <Link
                href="/monthly/next"
                className={`${linkClass("/monthly/next")} flex items-center justify-between`}
                onClick={onNavigate}
              >
                <span>Next Month</span>
                <span className="text-xs opacity-70">{nextLabel}</span>
              </Link>
              <Link href="/monthly/earlier" className={linkClass("/monthly/earlier")} onClick={onNavigate}>
                Earlier Months
              </Link>
              <Link href="/monthly/years" className={linkClass("/monthly/years")} onClick={onNavigate}>
                Earlier Years
              </Link>
            </div>
          )}
          {isPlatformOwner && (
            <Link href="/platform" className={linkClass("/platform")} onClick={onNavigate}>
              Admin
            </Link>
          )}
        </nav>
      </>
    );
  }

  // Bottom-of-sidebar profile/settings block — separate from renderNavContent
  // so it can sit at the bottom of the flex column (justify-between on the
  // <aside>/drawer) instead of scrolling away with a long nav list.
  function renderFooter(onNavigate?: () => void) {
    return (
      <div className="space-y-2 border-t border-slate-800/60 p-4">
        <Link href="/settings" className={iconLinkClass("/settings")} onClick={onNavigate}>
          <SettingsIcon size={16} className="shrink-0" />
          Settings
        </Link>
        <div className="flex items-center justify-between px-1 pt-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{baseCurrency} Standard</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop: always visible at md (768px) and up. flex/justify-between
          pins renderFooter() to the bottom per the approved mockup. */}
      <aside className="hidden w-52 shrink-0 flex-col justify-between bg-slate-900 text-slate-300 dark:bg-sidebar-dark md:flex">
        <div>{renderNavContent()}</div>
        {renderFooter()}
      </aside>

      {/* Mobile: hidden by default, opened via the hamburger in AppHeader. */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={close} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80%] flex-col justify-between overflow-y-auto bg-slate-900 text-slate-300 dark:bg-sidebar-dark">
            <div>{renderNavContent(close)}</div>
            {renderFooter(close)}
          </aside>
        </div>
      )}
    </>
  );
}
