"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// useSearchParams() opts this subtree out of static rendering and requires
// a <Suspense> boundary — split into an inner component so the page-level
// default export can provide one (a bare fallback is fine: the token read
// resolves on the same tick, this is never actually pending in practice).
function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/login?reset=success");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Link href="/" className="text-base font-bold text-slate-900">
            Smart Money Folio
          </Link>
          <p className="mt-6 text-sm text-slate-600">This reset link is missing its token.</p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block text-sm font-semibold text-emerald-600 hover:underline"
          >
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="text-base font-bold text-slate-900">
          Smart Money Folio
        </Link>
        <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">Set a new password</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-500">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring mt-1 w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-500">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            className="focus-ring w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Reset password"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
