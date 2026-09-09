"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/currencies";

type ProfileData = {
  name: string;
  city: string;
  address: string;
  operationalCurrency: string;
  residencyStatus: string;
};

export default function SettingsClient({
  initialProfile,
}: {
  initialProfile: ProfileData | null;
}) {
  return (
    <div className="mt-8 space-y-10">
      {initialProfile ? (
        <ProfileForm initialProfile={initialProfile} />
      ) : (
        <p className="border border-line bg-paper-2 px-4 py-3 text-base text-ink-2">
          We couldn't find a profile linked to your login, so profile
          details can't be edited here. Password changes are still
          available below.
        </p>
      )}
      <PasswordForm />
    </div>
  );
}

function ProfileForm({ initialProfile }: { initialProfile: ProfileData }) {
  const router = useRouter();
  const [name, setName] = useState(initialProfile.name);
  const [city, setCity] = useState(initialProfile.city);
  const [address, setAddress] = useState(initialProfile.address);
  const [operationalCurrency, setOperationalCurrency] = useState(initialProfile.operationalCurrency);
  const [residencyStatus, setResidencyStatus] = useState(initialProfile.residencyStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, city, address, operationalCurrency, residencyStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save your profile. Try again.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Profile</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4 border border-line bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-ink-2">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-base text-ink"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-2">City</label>
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-base text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2">Operational currency</label>
            <select
              value={operationalCurrency}
              onChange={(e) => setOperationalCurrency(e.target.value)}
              className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-base text-ink"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-2">Address</label>
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-base text-ink"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-2">Residency status</label>
          <select
            value={residencyStatus}
            onChange={(e) => setResidencyStatus(e.target.value)}
            className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-base text-ink"
          >
            <option value="NRI">NRI</option>
            <option value="RESIDENT_INDIAN">Resident Indian</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {error && <p className="text-base text-amber">{error}</p>}
        {saved && !error && <p className="text-base text-growth">Profile updated.</p>}

        <button
          type="submit"
          disabled={loading}
          className="focus-ring bg-ink px-4 py-2 text-base text-paper hover:bg-ink-2 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't change your password. Try again.");
        return;
      }
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Password</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4 border border-line bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-ink-2">Current password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-base text-ink"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-2">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-base text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2">Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="focus-ring mt-1 w-full border border-line bg-white px-3 py-2 text-base text-ink"
            />
          </div>
        </div>

        {error && <p className="text-base text-amber">{error}</p>}
        {saved && !error && <p className="text-base text-growth">Password changed.</p>}

        <button
          type="submit"
          disabled={loading}
          className="focus-ring bg-ink px-4 py-2 text-base text-paper hover:bg-ink-2 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
