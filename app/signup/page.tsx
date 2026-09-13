"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CURRENCIES } from "@/lib/currencies";
import { RELATIONSHIPS } from "@/lib/relationships";
import { findCountryForTimeZone } from "@/lib/countries";
import CountryTimeZoneFields from "@/components/CountryTimeZoneFields";
import DateOfBirthPicker from "@/components/DateOfBirthPicker";

type MemberDraft = {
  name: string;
  relationship: string;
  operationalCurrency: string;
  residencyStatus: "NRI" | "RESIDENT_INDIAN" | "OTHER";
  isMinor: boolean;
  dateOfBirth: string;
  city: string;
  address: string;
  state: string;
  postalCode: string;
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
  state: "",
  postalCode: "",
});

// Relationship options for "other" family members added in Step 2 — "Self"
// is excluded since the primary account holder is now a fixed, dedicated
// slot (members[0], captured entirely in Step 1), not something an
// additional member's dropdown should be able to claim too.
const OTHER_MEMBER_RELATIONSHIPS = RELATIONSHIPS.filter((r) => r !== "Self");

function StepCircle({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
        active || done
          ? "bg-emerald-600 text-white dark:bg-cyan-400 dark:text-slate-900"
          : "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500"
      }`}
    >
      {n}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1 — household + admin account + Self's KYC details.
  // Country/currency default to India/INR outright (our primary market)
  // rather than relying solely on browser-timezone detection below, which
  // can fail silently and leave these blank. Detection still runs and
  // overrides these defaults whenever it successfully finds a different
  // country, so this isn't a regression for non-Indian users.
  const [householdName, setHouseholdName] = useState("");
  const [country, setCountry] = useState("IN");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [baseCurrency, setBaseCurrency] = useState("INR");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Pre-fill (never auto-submit) from the browser's own timezone — only
  // when it maps to a country we know, so Country and Timezone start in
  // sync. If it doesn't match anything, the India/INR defaults above stand.
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const detectedCountry = findCountryForTimeZone(detected);
      if (detectedCountry) {
        setCountry(detectedCountry);
        setTimeZone(detected);
      }
    } catch {
      // Intl not available or detection failed — leave the India/INR defaults.
    }
  }, []);

  // members[0] is always the primary account holder ("Self") — its whole
  // profile, KYC fields included, is captured directly in Step 1 below, not
  // via the mapped card loop. Step 2 only ever renders members.slice(1).
  const [members, setMembers] = useState<MemberDraft[]>([
    { ...emptyMember(), name: "", relationship: "Self", isMinor: false },
  ]);
  const self = members[0];

  function updateMember(index: number, patch: Partial<MemberDraft>) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function updateSelf(patch: Partial<MemberDraft>) {
    updateMember(0, patch);
  }

  function addMember() {
    setMembers((prev) => [...prev, emptyMember()]);
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  // Validates household details AND Self's KYC fields before advancing —
  // Step 1's own Continue button is a plain <button type="button">, not a
  // form submit that would enforce the inputs' `required` attribute, so
  // this checks explicitly. Keeping this validation and the fields it
  // checks on the same screen (rather than split across steps) is what
  // structurally prevents the earlier signup bug's failure mode: there's no
  // way to advance past the fields without the button that checks them.
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
    if (!self.name.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (!self.dateOfBirth || !self.city.trim() || !self.address.trim() || !self.state.trim() || !self.postalCode.trim()) {
      setError("Date of birth, place, address, state, and PIN/postal code are required.");
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
          // No separate household-level Operational Currency control —
          // it's silently set equal to Base Currency, editable later from
          // Settings if ever needed.
          operationalCurrency: baseCurrency,
          email,
          password,
          members: members
            .map((m, i) => (i === 0 ? { ...m, operationalCurrency: baseCurrency } : m))
            .filter((m) => m.name.trim().length > 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create your household. Try again.");
        // Step 1 holds the KYC fields this rejection is almost always
        // about (a defensive server-side check the client-side validation
        // in goToMembers() above didn't happen to catch) — that's where the
        // user can actually act on the error.
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

  const STEP_LABELS = ["Household", "Family", "Review"];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 dark:bg-canvas">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-base font-bold text-slate-900 dark:text-white">
          Smart Money Folio
        </Link>

        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-canvas-card sm:p-8">
          {/* Numbered-circle stepper */}
          <div className="flex items-center">
            {[1, 2, 3].map((n, i) => (
              <div key={n} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <StepCircle n={n} active={step === n} done={step > n} />
                  <span
                    className={`text-[11px] font-semibold ${
                      step === n ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {STEP_LABELS[i]}
                  </span>
                </div>
                {n < 3 && (
                  <div
                    className={`mx-2 mb-4 h-0.5 flex-1 ${
                      step > n ? "bg-emerald-600 dark:bg-cyan-400" : "bg-slate-200 dark:bg-slate-800"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-6 border border-amber-600/40 bg-amber-600/5 px-3 py-2 text-sm text-amber-600 dark:border-amber-400/40 dark:bg-amber-400/5 dark:text-amber-400">
              {error}
            </p>
          )}

          {step === 1 && (
            <form onSubmit={goToMembers} className="mt-6 space-y-8">
              <div className="space-y-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  1. Household &amp; Currency
                </h2>
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

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Base Currency</label>
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
              </div>

              <hr className="border-slate-200/80 dark:border-slate-800" />

              <div className="space-y-5">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    2. Primary Administrator &amp; KYC Address
                  </h2>
                </div>

                <div className="border border-emerald-600/30 bg-emerald-600/5 px-3 py-2.5 text-xs text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/5 dark:text-emerald-300">
                  We collect your date of birth and address to verify your identity and keep your
                  household's financial records accurate — this stays private to your account.
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Full name</label>
                  <input
                    required
                    value={self.name}
                    onChange={(e) => updateSelf({ name: e.target.value })}
                    className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Date of birth</label>
                  <div className="mt-1">
                    <DateOfBirthPicker value={self.dateOfBirth} onChange={(v) => updateSelf({ dateOfBirth: v })} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Address</label>
                  <input
                    required
                    value={self.address}
                    onChange={(e) => updateSelf({ address: e.target.value })}
                    placeholder="Street, building, area"
                    className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">City</label>
                    <input
                      required
                      value={self.city}
                      onChange={(e) => updateSelf({ city: e.target.value })}
                      placeholder="Dubai"
                      className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">State</label>
                    <input
                      required
                      value={self.state}
                      onChange={(e) => updateSelf({ state: e.target.value })}
                      className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">PIN / Postal Code</label>
                    <input
                      required
                      value={self.postalCode}
                      onChange={(e) => updateSelf({ postalCode: e.target.value })}
                      className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-200/80 dark:border-slate-800" />

              <div className="space-y-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  3. Account Credentials
                </h2>
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
            <div className="mt-6 space-y-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add anyone whose accounts, assets, or expenses you'll want to track
                separately — a spouse, children, or anyone else. You can add or edit
                these later.
              </p>

              <div className="space-y-4">
                {members.slice(1).map((m, idx) => {
                  const i = idx + 1;
                  return (
                    <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Member {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMember(i)}
                          className="text-xs text-rose-600 hover:underline dark:text-rose-400"
                        >
                          Remove
                        </button>
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
                          {OTHER_MEMBER_RELATIONSHIPS.map((r) => (
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

                      <label className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={m.isMinor}
                          onChange={(e) => updateMember(i, { isMinor: e.target.checked })}
                        />
                        This person is a minor (no login will ever be created for them)
                      </label>
                    </div>
                  );
                })}
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
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
                <p className="font-semibold text-slate-900 dark:text-white">{householdName}</p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  {country} · {timeZone}
                </p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">Base currency {baseCurrency}</p>
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
        </div>

        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline dark:text-lime-400">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
