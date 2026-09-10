"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="focus-ring border border-slate-700 px-3 py-1.5 text-base text-slate-300 hover:border-slate-500 hover:text-white"
    >
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
