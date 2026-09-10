"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function ClientSidebar({
  isPlatformOwner,
  householdName,
  previousLabel,
  currentLabel,
  nextLabel,
}: {
  isPlatformOwner: boolean;
  householdName: string;
  previousLabel: string;
  currentLabel: string;
  nextLabel: string;
}) {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `block px-3 py-2 text-sm ${
      pathname === href ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <aside className="w-52 shrink-0 bg-slate-900 text-slate-300 dark:bg-sidebar-dark">
      <div className="px-4 py-4">
        <Link href="/dashboard" className="text-base font-bold text-blue-600 dark:text-lime-400">
          Smart Money Folio
        </Link>
        <p className="mt-0.5 text-xs text-slate-400">{householdName}</p>
      </div>
      <nav className="px-2">
        <Link href="/dashboard" className={linkClass("/dashboard")}>
          Dashboard
        </Link>
        <Link href="/goals" className={linkClass("/goals")}>
          Goals
        </Link>
        <Link href="/allocation" className={linkClass("/allocation")}>
          Targets
        </Link>
        <Link href="/accounts" className={linkClass("/accounts")}>
          Holdings
        </Link>
        <p className="mt-4 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          Monthly Tracking
        </p>
        <Link href="/monthly/base" className={linkClass("/monthly/base")}>
          Monthly Base
        </Link>
        <Link href="/monthly/previous" className={`${linkClass("/monthly/previous")} flex items-center justify-between`}>
          <span>Previous Month</span>
          <span className="text-xs opacity-70">{previousLabel}</span>
        </Link>
        <Link href="/monthly/current" className={`${linkClass("/monthly/current")} flex items-center justify-between`}>
          <span>Current Month</span>
          <span className="text-xs opacity-70">{currentLabel}</span>
        </Link>
        <Link href="/monthly/next" className={`${linkClass("/monthly/next")} flex items-center justify-between`}>
          <span>Next Month</span>
          <span className="text-xs opacity-70">{nextLabel}</span>
        </Link>
        <Link href="/monthly/earlier" className={linkClass("/monthly/earlier")}>
          Earlier Months
        </Link>
        <Link href="/monthly/years" className={linkClass("/monthly/years")}>
          Earlier Years
        </Link>
        <Link href="/settings" className={linkClass("/settings")}>
          Settings
        </Link>
        {isPlatformOwner && (
          <Link href="/platform" className={linkClass("/platform")}>
            Admin
          </Link>
        )}
      </nav>
      <div className="mt-6 flex items-center gap-2 px-4">
        <LogoutButton />
        <ThemeToggle />
      </div>
    </aside>
  );
}
