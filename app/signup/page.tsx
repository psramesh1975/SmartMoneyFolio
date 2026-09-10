"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CURRENCIES } from "@/lib/currencies";
import { RELATIONSHIPS } from "@/lib/relationships";
import { findCountryForTimeZone } from "@/lib/countries";
import CountryTimeZoneFields from "@/components/CountryTimeZoneFields";

type MemberDraft = {
  name: string;
  relationship: string;
  operationalCurrency: string;
  residencyStatus: "NRI" | "RESIDENT_INDIAN" | "OTHER";
  isMinor: boolean;
  dateOfBirth: string;
  city: string;
  address: string;
};

const emptyMember = (): MemberDraft => ({
  name: "",
  relationship: "",
  operationalCurrency: "USD",
  residencyStatus: "OTHER",
  isMinor: false,
  dateOfBirth: "",
  city: "",
  address: "",
});

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1 — household + admin account
  const [householdName, setHouseholdName] = useState("");
  const [country, setCountry] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [operationalCurrency, setOperationalCurrency] = useState("USD");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Pre-fill (never auto-submit) from the browser's own timezone — only
  // when it maps to a country we know, so Country and Timezone start in
  // sync. If it doesn't match anything, both fields just stay blank and the
  // household picks explicitly.
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const detectedCountry = findCountryForTimeZone(detected);
      if (detectedCountry) {
        setCountry(detectedCountry);
        setTimeZone(detected);
      }
    } catch {
      // Intl not available or detection failed — leave both blank.
    }
  }, []);

  // Step 2 — family members
  const [members, setMembers] = useState<MemberDraft[]>([
    { ...emptyMember(), name: "", relationship: "Self", isMinor: false },
  ]);

  function updateMember(index: number, patch: Partial<MemberDraft>) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function addMember() {
    setMembers((prev) => [...prev, emptyMember()]);
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  function goToMembers(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!householdName.trim()) {
      setError("Give your household a name.");
      return;
    }
    if (!country || !timeZone) {
      setError("Select your country and timezone — this decides which calendar month is \"current\" for you.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setStep(2);
  }

  async function handleCreate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdName,
          country,
          timeZone,
          baseCurrency,
          operationalCurrency,
          email,
          password,
          members: members.filter((m) => m.name.trim().length > 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create your household. Try again.");
        setStep(1);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setStep(1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 dark:bg-canvas">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-base font-bold text-slate-900 dark:text-white">
          Smart Money Folio
        </Link>

        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className={step === 1 ? "font-semibold text-slate-900 dark:text-white" : ""}>1. Household</span>
          <span className="text-slate-200/80 dark:text-slate-800">—</span>
          <span className={step === 2 ? "font-semibold text-slate-900 dark:text-white" : ""}>2. Family members</span>
          <span className="text-slate-200/80 dark:text-slate-800">—</span>
          <span className={step === 3 ? "font-semibold text-slate-900 dark:text-white" : ""}>3. Review</span>
        </div>

        {error && (
          <p className="mt-4 border border-amber-600/40 bg-amber-600/5 px-3 py-2 text-sm text-amber-600 dark:border-amber-400/40 dark:bg-amber-400/5 dark:text-amber-400">
            {error}
          </p>
        )}

        {step === 1 && (
          <form onSubmit={goToMembers} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Household name</label>
              <input
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="e.g. The Sharma Household"
                className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
              />
            </div>

            <CountryTimeZoneFields
              country={country}
              timeZone={timeZone}
              onCountryChange={setCountry}
              onTimeZoneChange={setTimeZone}
            />
            <p className="-mt-3 text-sm text-slate-500 dark:text-slate-400">
              This decides which calendar month is "Current" for your household.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                  Base currency (net worth)
                </label>
                <select
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                  Operational currency (day to day)
                </label>
                <select
                  value={operationalCurrency}
                  onChange={(e) => setOperationalCurrency(e.target.value)}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <hr className="border-slate-200/80 dark:border-slate-800" />

            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Your email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                Create a password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
              />
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">At least 8 characters. You'll be the household Admin.</p>
            </div>

            <button
              type="submit"
              className="focus-ring w-full bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Continue
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Add anyone whose accounts, assets, or expenses you'll want to track
              separately — a spouse, children, or anyone else. You can add or edit
              these later.
            </p>

            <div className="space-y-4">
              {members.map((m, i) => (
                <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Member {i + 1}
                    </span>
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMember(i)}
                        className="text-xs text-rose-600 hover:underline dark:text-rose-400"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <input
                      placeholder="Name"
                      value={m.name}
                      onChange={(e) => updateMember(i, { name: e.target.value })}
                      className="focus-ring border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                    />
                    <select
                      value={m.relationship}
                      onChange={(e) => updateMember(i, { relationship: e.target.value })}
                      className="focus-ring border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                    >
                      <option value="" disabled>
                        Relationship
                      </option>
                      {RELATIONSHIPS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <select
                      value={m.operationalCurrency}
                      onChange={(e) => updateMember(i, { operationalCurrency: e.target.value })}
                      className="focus-ring border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={m.residencyStatus}
                      onChange={(e) =>
                        updateMember(i, { residencyStatus: e.target.value as MemberDraft["residencyStatus"] })
                      }
                      className="focus-ring border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                    >
                      <option value="NRI">NRI</option>
                      <option value="RESIDENT_INDIAN">Resident Indian</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400">
                        Date of birth{m.relationship === "Self" && " *"}
                      </label>
                      <input
                        type="date"
                        required={m.relationship === "Self"}
                        value={m.dateOfBirth}
                        onChange={(e) => updateMember(i, { dateOfBirth: e.target.value })}
                        className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                      />
                    </div>
                    {m.relationship === "Self" && (
                      <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400">Place / City *</label>
                        <input
                          required
                          value={m.city}
                          onChange={(e) => updateMember(i, { city: e.target.value })}
                          placeholder="Dubai"
                          className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                  {m.relationship === "Self" && (
                    <div className="mt-3">
                      <label className="block text-sm text-slate-500 dark:text-slate-400">Address *</label>
                      <input
                        required
                        value={m.address}
                        onChange={(e) => updateMember(i, { address: e.target.value })}
                        placeholder="Street, building, area"
                        className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                      />
                    </div>
                  )}

                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={m.isMinor}
                      onChange={(e) => updateMember(i, { isMinor: e.target.checked })}
                    />
                    This person is a minor (no login will ever be created for them)
                  </label>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addMember}
              className="focus-ring border border-slate-200/80 px-4 py-2 text-sm text-slate-900 hover:border-blue-600 hover:text-blue-600 dark:border-slate-800 dark:text-white dark:hover:border-lime-400 dark:hover:text-lime-400"
            >
              + Add another member
            </button>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="focus-ring border border-slate-200/80 px-4 py-2.5 text-slate-900 hover:border-slate-900 dark:border-slate-800 dark:text-white dark:hover:border-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="focus-ring flex-1 bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
              <p className="font-semibold text-slate-900 dark:text-white">{householdName}</p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                {country} · {timeZone}
              </p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                Base currency {baseCurrency} · Operational currency {operationalCurrency}
              </p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">Admin login: {email}</p>
              <hr className="my-3 border-slate-200/80 dark:border-slate-800" />
              <p className="font-semibold text-slate-900 dark:text-white">Family members</p>
              <ul className="mt-1 space-y-1 text-slate-500 dark:text-slate-400">
                {members
                  .filter((m) => m.name.trim())
                  .map((m, i) => (
                    <li key={i}>
                      {m.name} — {m.relationship || "Unspecified"} ({m.operationalCurrency},{" "}
                      {m.residencyStatus.replace("_", " ")}
                      {m.isMinor ? ", minor" : ""})
                    </li>
                  ))}
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="focus-ring border border-slate-200/80 px-4 py-2.5 text-slate-900 hover:border-slate-900 dark:border-slate-800 dark:text-white dark:hover:border-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="focus-ring flex-1 bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {loading ? "Creating…" : "Create household"}
              </button>
            </div>
          </div>
        )}

        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline dark:text-lime-400">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
