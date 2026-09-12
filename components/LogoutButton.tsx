"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DEFAULT_CLASS =
  "focus-ring border border-slate-200/80 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white";

// className override lets AppHeader's ticker strip render this as a plain
// text link (per the approved mockup) without duplicating the logout logic.
export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} disabled={loading} className={className ?? DEFAULT_CLASS}>
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
