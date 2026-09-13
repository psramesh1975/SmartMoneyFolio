"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password }),
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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
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
                data-testid="login-email"
                className="focus-ring mt-1 w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-500">
                  Password
                </label>
                <Link href="/forgot-password" className="text-sm font-medium text-emerald-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
                className="focus-ring mt-1 w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-3 py-2 text-sm text-amber-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              className="focus-ring w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            No account?{" "}
            <Link href="/signup" className="text-emerald-600 hover:underline">
              Create household
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">🔒 256-bit encryption • One single truth</p>
      </div>
    </main>
  );
}
