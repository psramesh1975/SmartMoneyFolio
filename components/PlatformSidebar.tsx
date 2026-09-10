"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function PlatformSidebar() {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `block px-3 py-2 text-base ${
      pathname === href ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <aside className="w-52 shrink-0 bg-slate-900 text-slate-300 dark:bg-sidebar-dark">
      <div className="px-4 py-4">
        <Link href="/platform" className="text-xl font-extrabold tracking-tight text-white">
          Smart Money Folio
        </Link>
        <p className="mt-0.5 text-xs text-slate-400">Admin</p>
      </div>
      <nav className="px-2">
        <Link href="/platform" className={linkClass("/platform")}>
          Dashboard
        </Link>
        <Link href="/platform/clients" className={linkClass("/platform/clients")}>
          Client Management
        </Link>
      </nav>
      <div className="mt-6 flex items-center gap-2 px-4">
        <LogoutButton />
        <ThemeToggle />
      </div>
    </aside>
  );
}
