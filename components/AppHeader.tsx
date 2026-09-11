"use client";

import { Menu } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { useMobileNav } from "@/components/MobileNavContext";

export default function AppHeader({ householdName }: { householdName: string }) {
  const { toggle, isOpen } = useMobileNav();

  return (
    <header className="flex items-center justify-between border-b border-slate-200/80 bg-white px-8 py-3 dark:border-slate-800 dark:bg-canvas-card">
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
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{householdName}</span>
      </div>
      <LogoutButton />
    </header>
  );
}
