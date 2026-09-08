"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CURRENCIES } from "@/lib/currencies";
import { RELATIONSHIPS } from "@/lib/relationships";

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
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [operationalCurrency, setOperationalCurrency] = useState("USD");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
    <main className="min-h-screen bg-paper px-6 py-12">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="font-display text-lg italic text-ink">
          WealthBridge
        </Link>

        <div className="mt-6 flex items-center gap-2 text-xs text-ink-2">
          <span className={step === 1 ? "font-semibold text-ink" : ""}>1. Household</span>
          <span className="text-line">—</span>
          <span className={step === 2 ? "font-semibold text-ink" : ""}>2. Family members</span>
          <span className="text-line">—</span>
          <span className={step === 3 ? "font-semibold text-ink" : ""}>3. Review</span>
        </div>

        {error && (
          <p className="mt-4 border border-dirham/40 bg-dirham/5 px-3 py-2 text-sm text-dirham">
            {error}
          </p>
        )}

        {step === 1 && (
          <form onSubmit={goToMembers} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink-2">Household name</label>
              <input
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="e.g. The Sharma Household"
                className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-ink"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-2">
                  Base currency (net worth)
                </label>
                <select
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-ink"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2">
                  Operational currency (day to day)
                </label>
                <select
                  value={operationalCurrency}
                  onChange={(e) => setOperationalCurrency(e.target.value)}
                  className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-ink"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <hr className="border-line" />

            <div>
              <label className="block text-sm font-medium text-ink-2">Your email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2">
                Create a password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-ink"
              />
              <p className="mt-1 text-xs text-ink-2">At least 8 characters. You'll be the household Admin.</p>
            </div>

            <button
              type="submit"
              className="focus-ring w-full bg-ink px-4 py-2.5 text-paper hover:bg-ink-2"
            >
              Continue
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-6">
            <p className="text-sm text-ink-2">
              Add anyone whose accounts, assets, or expenses you'll want to track
              separately — a spouse, children, or anyone else. You can add or edit
              these later.
            </p>

            <div className="space-y-4">
              {members.map((m, i) => (
                <div key={i} className="border border-line bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-2">
                      Member {i + 1}
                    </span>
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMember(i)}
                        className="text-xs text-dirham hover:underline"
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
                      className="focus-ring border border-line bg-white px-3 py-2 text-sm text-ink"
                    />
                    <select
                      value={m.relationship}
                      onChange={(e) => updateMember(i, { relationship: e.target.value })}
                      className="focus-ring border border-line bg-white px-3 py-2 text-sm text-ink"
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
                      className="focus-ring border border-line bg-white px-3 py-2 text-sm text-ink"
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
                      className="focus-ring border border-line bg-white px-3 py-2 text-sm text-ink"
                    >
                      <option value="NRI">NRI</option>
                      <option value="RESIDENT_INDIAN">Resident Indian</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-ink-2">
                        Date of birth{m.relationship === "Self" && " *"}
                      </label>
                      <input
                        type="date"
                        required={m.relationship === "Self"}
                        value={m.dateOfBirth}
                        onChange={(e) => updateMember(i, { dateOfBirth: e.target.value })}
                        className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-ink"
                      />
                    </div>
                    {m.relationship === "Self" && (
                      <div>
                        <label className="block text-xs text-ink-2">Place / City *</label>
                        <input
                          required
                          value={m.city}
                          onChange={(e) => updateMember(i, { city: e.target.value })}
                          placeholder="Dubai"
                          className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-ink"
                        />
                      </div>
                    )}
                  </div>
                  {m.relationship === "Self" && (
                    <div className="mt-3">
                      <label className="block text-xs text-ink-2">Address *</label>
                      <input
                        required
                        value={m.address}
                        onChange={(e) => updateMember(i, { address: e.target.value })}
                        placeholder="Street, building, area"
                        className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-ink"
                      />
                    </div>
                  )}

                  <label className="mt-3 flex items-center gap-2 text-sm text-ink-2">
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
              className="focus-ring border border-line px-4 py-2 text-sm text-ink hover:border-span hover:text-span"
            >
              + Add another member
            </button>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="focus-ring border border-line px-4 py-2.5 text-ink hover:border-ink"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="focus-ring flex-1 bg-ink px-4 py-2.5 text-paper hover:bg-ink-2"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-6">
            <div className="border border-line bg-white p-4 text-sm">
              <p className="font-semibold text-ink">{householdName}</p>
              <p className="mt-1 text-ink-2">
                Base currency {baseCurrency} · Operational currency {operationalCurrency}
              </p>
              <p className="mt-1 text-ink-2">Admin login: {email}</p>
              <hr className="my-3 border-line" />
              <p className="font-semibold text-ink">Family members</p>
              <ul className="mt-1 space-y-1 text-ink-2">
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
                className="focus-ring border border-line px-4 py-2.5 text-ink hover:border-ink"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="focus-ring flex-1 bg-ink px-4 py-2.5 text-paper hover:bg-ink-2 disabled:opacity-60"
              >
                {loading ? "Creating…" : "Create household"}
              </button>
            </div>
          </div>
        )}

        <p className="mt-8 text-sm text-ink-2">
          Already have an account?{" "}
          <Link href="/login" className="text-span hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
