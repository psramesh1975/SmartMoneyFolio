"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { CURRENCIES } from "@/lib/currencies";
import { computeAmortization } from "@/lib/amortization";

type FamilyMemberOption = { id: string; name: string };

export type LiabilityRow = {
  id: string;
  familyMemberId: string;
  familyMemberName: string;
  liabilityType: string;
  name: string;
  currency: string;
  outstandingBalance: string;
  originalAmount: string | null;
  interestRate: string | null;
  emiAmount: string | null;
  targetPayoffDate: string | null; // ISO date string, or null
};

const LIABILITY_TYPES = [
  { value: "HOME_LOAN", label: "Home Loan" },
  { value: "CAR_LOAN", label: "Car Loan" },
  { value: "PERSONAL_LOAN", label: "Personal Loan" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEVICE_EMI", label: "Device EMI" },
  { value: "OTHER", label: "Other" },
] as const;

function liabilityTypeLabel(value: string): string {
  return LIABILITY_TYPES.find((t) => t.value === value)?.label ?? value;
}

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

export default function LiabilitiesClient({
  familyMembers,
  initialLiabilities,
}: {
  familyMembers: FamilyMemberOption[];
  initialLiabilities: LiabilityRow[];
}) {
  const router = useRouter();
  const [liabilities, setLiabilities] = useState(initialLiabilities);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [familyMemberId, setFamilyMemberId] = useState(familyMembers[0]?.id ?? "");
  const [liabilityType, setLiabilityType] = useState<(typeof LIABILITY_TYPES)[number]["value"]>("HOME_LOAN");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [outstandingBalance, setOutstandingBalance] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [emiAmount, setEmiAmount] = useState("");
  const [targetPayoffDate, setTargetPayoffDate] = useState("");

  function resetForm() {
    setEditingId(null);
    setFamilyMemberId(familyMembers[0]?.id ?? "");
    setLiabilityType("HOME_LOAN");
    setName("");
    setCurrency("USD");
    setOutstandingBalance("");
    setOriginalAmount("");
    setInterestRate("");
    setEmiAmount("");
    setTargetPayoffDate("");
    setError(null);
  }

  function startEdit(l: LiabilityRow) {
    setEditingId(l.id);
    setFamilyMemberId(l.familyMemberId);
    setLiabilityType(l.liabilityType as typeof liabilityType);
    setName(l.name);
    setCurrency(l.currency);
    setOutstandingBalance(l.outstandingBalance);
    setOriginalAmount(l.originalAmount ?? "");
    setInterestRate(l.interestRate ?? "");
    setEmiAmount(l.emiAmount ?? "");
    setTargetPayoffDate(l.targetPayoffDate ? l.targetPayoffDate.slice(0, 10) : "");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!familyMemberId || !name.trim() || !outstandingBalance) {
      setError("Fill in the liability name, outstanding balance, and family member.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(editingId ? `/api/liabilities/${editingId}` : "/api/liabilities", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyMemberId,
          liabilityType,
          name,
          currency,
          outstandingBalance,
          originalAmount: originalAmount || undefined,
          interestRate: interestRate || undefined,
          emiAmount: emiAmount || undefined,
          targetPayoffDate: targetPayoffDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that liability.");
        return;
      }
      const member = familyMembers.find((m) => m.id === familyMemberId);
      const updated: LiabilityRow = {
        id: editingId ?? data.liability.id,
        familyMemberId,
        familyMemberName: member?.name ?? "",
        liabilityType,
        name,
        currency,
        outstandingBalance,
        originalAmount: originalAmount || null,
        interestRate: interestRate || null,
        emiAmount: emiAmount || null,
        targetPayoffDate: targetPayoffDate || null,
      };
      if (editingId) {
        setLiabilities((prev) => prev.map((l) => (l.id === editingId ? updated : l)));
      } else {
        setLiabilities((prev) => [...prev, updated]);
      }
      resetForm();
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLiabilities((prev) => prev.filter((l) => l.id !== id));
    if (editingId === id) resetForm();
    await fetch(`/api/liabilities/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-8">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {editingId ? `Editing ${name || "liability"}` : "Add a new liability"}
          </p>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-500 hover:underline dark:text-slate-400"
            >
              Cancel
            </button>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Family member</label>
          <select
            value={familyMemberId}
            onChange={(e) => setFamilyMemberId(e.target.value)}
            className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
          >
            {familyMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Type</label>
          <select
            value={liabilityType}
            onChange={(e) => setLiabilityType(e.target.value as typeof liabilityType)}
            className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
          >
            {LIABILITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Liability name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ICICI Home Loan, Credit Card Running Balance…"
            className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Outstanding balance</label>
          <div className="mt-1 flex gap-1">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="focus-ring w-20 border border-slate-200/80 bg-white px-1 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={outstandingBalance}
              onChange={(e) => setOutstandingBalance(e.target.value)}
              placeholder="250000"
              className="focus-ring w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Original amount (optional)</label>
          <input
            type="number"
            value={originalAmount}
            onChange={(e) => setOriginalAmount(e.target.value)}
            placeholder="For payoff progress %"
            className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Interest rate % (optional)</label>
          <input
            type="number"
            step="0.01"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="0 for credit card / 0% EMI"
            className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Monthly EMI (optional)</label>
          <input
            type="number"
            value={emiAmount}
            onChange={(e) => setEmiAmount(e.target.value)}
            className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Target payoff date (optional)</label>
          <input
            type="date"
            value={targetPayoffDate}
            onChange={(e) => setTargetPayoffDate(e.target.value)}
            className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="focus-ring w-full bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {loading ? "Saving…" : editingId ? "Save changes" : "Add liability"}
          </button>
        </div>
        {error && <p className="sm:col-span-2 lg:col-span-4 text-sm text-amber-600 dark:text-amber-400">{error}</p>}
      </form>

      <div className="divide-y divide-slate-200/80 rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow dark:divide-slate-800 dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
        {liabilities.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
            No liabilities added yet. Use the form above to add your first one.
          </p>
        )}
        {liabilities.map((l) => {
          const isExpanded = expandedId === l.id;
          const breakdown = computeAmortization({
            outstandingBalance: Number(l.outstandingBalance),
            originalAmount: l.originalAmount ? Number(l.originalAmount) : null,
            interestRate: l.interestRate ? Number(l.interestRate) : null,
            emiAmount: l.emiAmount ? Number(l.emiAmount) : null,
            targetPayoffDate: l.targetPayoffDate ? new Date(l.targetPayoffDate) : null,
          });
          return (
            <div key={l.id}>
              <div className="flex w-full items-center justify-between px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : l.id)}
                  className="focus-ring flex-1 text-left"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{l.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {l.familyMemberName} · {liabilityTypeLabel(l.liabilityType)}
                  </p>
                </button>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-900 dark:text-white">
                    {l.currency} {fmt(Number(l.outstandingBalance))}
                  </span>
                  <button
                    onClick={() => startEdit(l)}
                    aria-label="Edit"
                    className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : l.id)}
                    className="text-slate-400 dark:text-slate-500"
                  >
                    {isExpanded ? "–" : "+"}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-white/5">
                  {breakdown.isAmortizing ? (
                    <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Monthly interest</p>
                        <p className="font-medium text-rose-600 dark:text-rose-400">
                          {l.currency} {fmt(breakdown.monthlyInterest ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Monthly principal</p>
                        <p className="font-medium text-emerald-600 dark:text-cyan-400">
                          {l.currency} {fmt(breakdown.monthlyPrincipal ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Months remaining</p>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {breakdown.monthsRemaining ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Interest rate</p>
                        <p className="font-medium text-slate-900 dark:text-white">{l.interestRate}%</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Running balance — no interest.</p>
                  )}

                  {breakdown.percentPaidOff !== null ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Paid off</span>
                        <span>{Math.round(breakdown.percentPaidOff)}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
                        <div
                          className="h-full bg-blue-600 dark:bg-lime-400"
                          style={{ width: `${breakdown.percentPaidOff}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Add original loan amount to track payoff progress.
                    </p>
                  )}

                  <button
                    onClick={() => handleDelete(l.id)}
                    className="mt-3 text-xs text-amber-600 hover:underline dark:text-amber-400"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
