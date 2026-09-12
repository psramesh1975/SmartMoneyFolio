"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, Landmark, CreditCard, CalendarDays, Settings as SettingsIcon } from "lucide-react";
import { useMobileNav } from "@/components/MobileNavContext";
import FutureMonthsSection, { type DraftMonth } from "@/components/FutureMonthsSection";
import AddDraftMonthModal from "@/components/AddDraftMonthModal";
import { MONTH_LABELS, type Period } from "@/lib/monthly-periods";

export default function ClientSidebar({
  isPlatformOwner,
  householdName,
  previousLabel,
  currentLabel,
  nextLabel,
  goalTargetLabel,
  baseCurrency,
  draftMonths,
  nextPeriod,
  earlierMonthsRangeLabel,
  earlierYearsRangeLabel,
  appVersion,
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
  // Forward Simulation draft months beyond Next Month that this household
  // has already initialized (lib/tracking-data.ts's getDraftMonths) — real
  // state, not hardcoded, per FutureMonthsSection.tsx's own setup note.
  draftMonths: { year: number; month: number; label: string }[];
  nextPeriod: Period;
  // e.g. "Jan – Jul 2026" — this year's months before Previous Month, or
  // null when there are none yet (January, or a brand-new household).
  earlierMonthsRangeLabel: string | null;
  // e.g. "2023 – 2025" — every archived year with actual data, or null
  // when nothing's been archived yet.
  earlierYearsRangeLabel: string | null;
  // package.json's own version — real, not a marketing "v2.4"-style figure.
  appVersion: string;
}) {
  const pathname = usePathname(); // still needed for per-link active highlighting
  const { isOpen, close } = useMobileNav();
  const [showAddMonthModal, setShowAddMonthModal] = useState(false);

  const futureMonthItems: DraftMonth[] = draftMonths.map((d) => {
    const href = `/tracking/${d.year}/${MONTH_LABELS[d.month - 1].toLowerCase()}`;
    return { label: d.label, href, status: pathname === href ? "active-draft" : "draft" };
  });

  // The mobile drawer shouldn't survive a navigation — close it whenever the
  // path changes. Deliberately depends on `pathname` alone, not `close`
  // (whose identity from context isn't memoized): this should fire once per
  // route change, not once per render.
  useEffect(() => {
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Row height standardized to py-1.5 everywhere under Monthly Tracking —
  // previously this was py-2, one notch taller than Future Months' own rows
  // (components/FutureMonthsSection.tsx, given as-is), which read as
  // inconsistent once the two sat directly next to each other.
  const linkClass = (href: string) =>
    `block px-3 py-1.5 text-sm ${
      pathname === href ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`;

  // Status-pill language shared with Future Months' Draft/Active Draft pills
  // (same sizing/shape) — "Current" is the third status in that family, so
  // it gets the same solid treatment Active Draft uses rather than the
  // plain month-abbreviation text this row used to show.
  const currentMonthActive = pathname === "/monthly/current";
  const currentMonthClass = currentMonthActive
    ? "flex items-center justify-between py-1.5 px-2 text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
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

          {/* Static uppercase section label — replaces the old expand/
              collapse button. Every row underneath is always visible now;
              Future Months keeps its own independent collapse (it's a
              genuinely long, growable list), but the group itself no longer
              needs one on top of that. */}
          <div className="mt-4 flex items-center gap-2 px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <CalendarDays size={12} className="shrink-0" />
            Monthly Tracking
          </div>

          <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
            <Link href="/monthly/base" className={linkClass("/monthly/base")} onClick={onNavigate}>
              Monthly Base
            </Link>
            <Link
              href="/monthly/previous"
              className={`${linkClass("/monthly/previous")} flex items-center justify-between`}
              onClick={onNavigate}
            >
              {/* "Previous"/"Next" rather than "Previous Month"/"Next Month" —
                  MONTHLY TRACKING already establishes the context above, and
                  the full wording didn't leave room for the trailing month
                  label at the sidebar's 208px width without wrapping. */}
              <span>Previous</span>
              <span className="text-xs opacity-70">{previousLabel}</span>
            </Link>
            {/* Current Month follows Future Months' own label+pill shape
                (month on the left, status on the right) instead of
                "Current Month" + a same-word pill, which said "Current"
                twice. */}
            <Link href="/monthly/current" className={currentMonthClass} onClick={onNavigate}>
              <span>{currentLabel}</span>
              <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold text-slate-900">Current</span>
            </Link>
            <Link
              href="/monthly/next"
              className={`${linkClass("/monthly/next")} flex items-center justify-between`}
              onClick={onNavigate}
            >
              <span>Next</span>
              <span className="text-xs opacity-70">{nextLabel}</span>
            </Link>
            <FutureMonthsSection draftMonths={futureMonthItems} onAddMonth={() => setShowAddMonthModal(true)} />
            {/* Earlier Months/Years: the range label ("Jan – Jul 2026",
                "2023 – 2025") runs too long to sit on the same line as the
                label at this width — stacked underneath instead, same
                pattern as the brand block's name + household subtitle. */}
            <Link href="/monthly/earlier" className={linkClass("/monthly/earlier")} onClick={onNavigate}>
              <span className="block">Earlier Months</span>
              {earlierMonthsRangeLabel && <span className="block text-xs opacity-70">{earlierMonthsRangeLabel}</span>}
            </Link>
            <Link href="/monthly/years" className={linkClass("/monthly/years")} onClick={onNavigate}>
              <span className="block">Earlier Years</span>
              {earlierYearsRangeLabel && <span className="block text-xs opacity-70">{earlierYearsRangeLabel}</span>}
            </Link>
          </div>

          {isPlatformOwner && (
            <Link href="/platform" className={`${linkClass("/platform")} mt-4`} onClick={onNavigate}>
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
          <span className="font-mono">v{appVersion}</span>
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

      {showAddMonthModal && (
        <AddDraftMonthModal
          nextPeriod={nextPeriod}
          existingDrafts={draftMonths}
          onClose={() => setShowAddMonthModal(false)}
        />
      )}
    </>
  );
}
