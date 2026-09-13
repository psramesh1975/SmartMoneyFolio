"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Network failure or not — still show the same generic success
      // message below, matching the API's own anti-enumeration behavior.
    }
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="text-base font-bold text-slate-900">
          Smart Money Folio
        </Link>
        <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">Reset your password</h1>

        {submitted ? (
          <p className="mt-4 text-sm text-slate-600">
            If an account exists with that email, a reset link has been sent. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-500">
                Email address
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
            <button
              type="submit"
              disabled={loading}
              className="focus-ring w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-slate-500">
          <Link href="/login" className="font-semibold text-emerald-600 hover:underline">
            ← Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
