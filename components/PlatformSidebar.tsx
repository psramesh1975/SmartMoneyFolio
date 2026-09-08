"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

export default function PlatformSidebar() {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `block px-3 py-2 text-sm ${
      pathname === href ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"
    }`;

  return (
    <aside className="w-52 shrink-0 border-r border-line bg-white">
      <div className="px-4 py-4">
        <Link href="/platform" className="font-display text-lg italic text-ink">
          WealthBridge
        </Link>
        <p className="mt-0.5 text-xs text-ink-2">Admin</p>
      </div>
      <nav className="px-2">
        <Link href="/platform" className={linkClass("/platform")}>
          Dashboard
        </Link>
        <Link href="/platform/clients" className={linkClass("/platform/clients")}>
          User Management
        </Link>
      </nav>
      <div className="mt-6 px-4">
        <LogoutButton />
      </div>
    </aside>
  );
}
