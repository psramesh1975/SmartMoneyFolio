"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center p-4 selection:bg-blue-600 selection:text-white"
      style={{
        backgroundColor: "#FFFFFF",
        backgroundImage:
          "linear-gradient(215deg, transparent 40%, rgba(59, 130, 246, 0.22) 100%), " +
          "linear-gradient(145deg, transparent 40%, rgba(79, 70, 229, 0.22) 100%), " +
          "radial-gradient(ellipse 130% 70% at 50% 100%, #2563EB 0%, #1D4ED8 35%, #93C5FD 75%, transparent 100%), " +
          "linear-gradient(180deg, #FFFFFF 0%, #F0F9FF 35%, #BAE6FD 65%, #3B82F6 100%)",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/40 bg-white/90 p-8 shadow-xl backdrop-blur-sm">
        <Link href="/" className="text-base font-bold text-slate-900">
          Smart Money Folio
        </Link>
        <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-900">Log in</h1>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-500">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus-ring mt-1 w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-500">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring mt-1 w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-slate-300"
            />
            Remember me for 7 days
          </label>

          {error && (
            <p className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-3 py-2 text-sm text-amber-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-500">
          New here?{" "}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
