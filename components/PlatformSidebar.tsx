"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Users, CreditCard, Activity, Settings as SettingsIcon } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

// Nav items point at real, working routes only. Subscription / System
// Health / Settings are intentionally placeholder pages for now (per
// product decision) — they render but don't do anything functional yet.
const NAV_ITEMS = [
  { href: "/platform", label: "Dashboard", icon: LayoutGrid },
  { href: "/platform/clients", label: "Client Management", icon: Users },
  { href: "/platform/subscription", label: "Subscription", icon: CreditCard },
  { href: "/platform/system-health", label: "System Health", icon: Activity },
  { href: "/platform/settings", label: "Settings", icon: SettingsIcon },
];

export default function PlatformSidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();

  const initials = adminEmail.slice(0, 2).toUpperCase();

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-slate-800/80 bg-sidebar-dark p-5">
      <div className="space-y-6">
        {/* Brand & Super Admin tag */}
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-lg font-black text-slate-950 shadow-lg shadow-emerald-500/20">
            S
          </div>
          <div>
            <h1 className="text-sm font-extrabold leading-tight tracking-tight text-white">Smart Money Folio</h1>
            <span className="mt-0.5 inline-block rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
              Super Admin
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1 text-xs font-semibold">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/platform" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`focus-ring flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition ${
                  active
                    ? "border border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-400"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Admin footer & quick actions */}
      <div className="space-y-3 border-t border-slate-800/80 pt-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-xs font-bold text-emerald-400">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold leading-tight text-white">Super Admin</p>
              <p className="truncate text-[10px] text-slate-400">{adminEmail}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-1 text-xs">
          <Link href="/dashboard" className="font-semibold text-emerald-400 hover:underline">
            ← Back to App
          </Link>
          <LogoutButton className="font-semibold text-slate-400 hover:text-white" />
        </div>
      </div>
    </aside>
  );
}
