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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-canvas">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Smart Money Folio
        </Link>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Log in</h1>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-base font-medium text-slate-500 dark:text-slate-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-base font-medium text-slate-500 dark:text-slate-400">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            />
          </div>

          {error && (
            <p className="border border-amber-600/40 bg-amber-600/5 px-3 py-2 text-base text-amber-600 dark:border-amber-400/40 dark:bg-amber-400/5 dark:text-amber-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring w-full bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-base text-slate-500 dark:text-slate-400">
          New here?{" "}
          <Link href="/signup" className="text-blue-600 hover:underline dark:text-lime-400">
            Create a household
          </Link>
        </p>
      </div>
    </main>
  );
}
