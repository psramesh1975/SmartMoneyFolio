"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Smartphone, CreditCard, Layers, Pencil, ChevronRight } from "lucide-react";
import { CURRENCIES } from "@/lib/currencies";
import { computeAmortization } from "@/lib/amortization";
import { ratioTone, type DebtSnapshot } from "@/lib/dashboard-data";
import { LIABILITY_CATEGORIES, LIABILITY_TYPES, type LiabilityTypeValue } from "@/lib/liability-categories";
import LiabilityAmortizationPanel from "@/components/LiabilityAmortizationPanel";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Home,
  Smartphone,
  CreditCard,
  Layers,
};

type FamilyMemberOption = { id: string; name: string };

export type LiabilityRow = {
  id: string;
  familyMemberId: string;
  familyMemberName: string;
  liabilityType: LiabilityTypeValue;
  name: string;
  currency: string;
  outstandingBalance: string;
  originalAmount: string | null;
  interestRate: string | null;
  emiAmount: string | null;
  targetPayoffDate: string | null; // ISO date string, or null
  accountReference: string | null;
  isRevolving: boolean;
  statementDueDay: number | null;
};

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function isAmortizing(l: LiabilityRow): boolean {
  return !!l.interestRate && Number(l.interestRate) > 0 && !!l.emiAmount;
}

type FormState = {
  familyMemberId: string;
  liabilityType: LiabilityTypeValue;
  name: string;
  currency: string;
  outstandingBalance: string;
  originalAmount: string;
  interestRate: string;
  emiAmount: string;
  targetPayoffDate: string;
  accountReference: string;
  statementDueDay: string;
};

function emptyForm(defaultMemberId: string): FormState {
  return {
    familyMemberId: defaultMemberId,
    liabilityType: "HOME_LOAN",
    name: "",
    currency: "USD",
    outstandingBalance: "",
    originalAmount: "",
    interestRate: "",
    emiAmount: "",
    targetPayoffDate: "",
    accountReference: "",
    statementDueDay: "",
  };
}

export default function LiabilitiesClient({
  familyMembers,
  initialLiabilities,
  baseCurrency,
  debtSnapshot,
}: {
  familyMembers: FamilyMemberOption[];
  initialLiabilities: LiabilityRow[];
  baseCurrency: string;
  debtSnapshot: DebtSnapshot;
}) {
  const router = useRouter();
  const [liabilities, setLiabilities] = useState(initialLiabilities);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(familyMembers[0]?.id ?? ""));

  const [selectedOwner, setSelectedOwner] = useState<string>("ALL");
  // Mortgages expanded by default, matching the approved mockup; rest collapsed.
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ mortgages: true });
  const [inspectedId, setInspectedId] = useState<string | null>(null);

  const filtered = selectedOwner === "ALL" ? liabilities : liabilities.filter((l) => l.familyMemberId === selectedOwner);

  function toggleCategory(id: string) {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm(familyMembers[0]?.id ?? ""));
    setError(null);
    setShowForm(false);
  }

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm(familyMembers[0]?.id ?? ""));
    setError(null);
    setShowForm(true);
  }

  function startEdit(l: LiabilityRow) {
    setEditingId(l.id);
    setForm({
      familyMemberId: l.familyMemberId,
      liabilityType: l.liabilityType,
      name: l.name,
      currency: l.currency,
      outstandingBalance: l.outstandingBalance,
      originalAmount: l.originalAmount ?? "",
      interestRate: l.interestRate ?? "",
      emiAmount: l.emiAmount ?? "",
      targetPayoffDate: l.targetPayoffDate ? l.targetPayoffDate.slice(0, 10) : "",
      accountReference: l.accountReference ?? "",
      statementDueDay: l.statementDueDay != null ? String(l.statementDueDay) : "",
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.familyMemberId || !form.name.trim() || !form.outstandingBalance) {
      setError("Fill in the liability name, outstanding balance, and family member.");
      return;
    }
    const isCreditCard = form.liabilityType === "CREDIT_CARD";

    const payload: Record<string, unknown> = {
      familyMemberId: form.familyMemberId,
      liabilityType: form.liabilityType,
      name: form.name,
      currency: form.currency,
      outstandingBalance: form.outstandingBalance,
    };
    if (form.accountReference) payload.accountReference = form.accountReference;
    if (form.interestRate) payload.interestRate = form.interestRate;
    if (form.emiAmount) payload.emiAmount = form.emiAmount;
    if (isCreditCard) {
      payload.isRevolving = true;
      if (form.statementDueDay) payload.statementDueDay = Number(form.statementDueDay);
    } else {
      if (form.originalAmount) payload.originalAmount = form.originalAmount;
      if (form.targetPayoffDate) payload.targetPayoffDate = form.targetPayoffDate;
    }

    setLoading(true);
    try {
      const res = await fetch(editingId ? `/api/liabilities/${editingId}` : "/api/liabilities", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that liability.");
        return;
      }
      const member = familyMembers.find((m) => m.id === form.familyMemberId);
      const updated: LiabilityRow = {
        id: editingId ?? data.liability.id,
        familyMemberId: form.familyMemberId,
        familyMemberName: member?.name ?? "",
        liabilityType: form.liabilityType,
        name: form.name,
        currency: form.currency,
        outstandingBalance: form.outstandingBalance,
        originalAmount: isCreditCard ? null : form.originalAmount || null,
        interestRate: form.interestRate || null,
        emiAmount: form.emiAmount || null,
        targetPayoffDate: isCreditCard ? null : form.targetPayoffDate || null,
        accountReference: form.accountReference || null,
        isRevolving: isCreditCard,
        statementDueDay: isCreditCard && form.statementDueDay ? Number(form.statementDueDay) : null,
      };
      setLiabilities((prev) => (editingId ? prev.map((l) => (l.id === editingId ? updated : l)) : [...prev, updated]));
      router.refresh();
      resetForm();
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

  const isCreditCard = form.liabilityType === "CREDIT_CARD";

  return (
    <div className="mt-8 space-y-8">
      {/* KPI cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Outstanding Principal
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
            {debtSnapshot.baseCurrency} {fmt(debtSnapshot.totalOutstandingPrincipal)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {debtSnapshot.activeLiabilityCount} active {debtSnapshot.activeLiabilityCount === 1 ? "account" : "accounts"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Monthly Debt Service
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {debtSnapshot.baseCurrency} {fmt(debtSnapshot.monthlyDebtService)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total EMI, all loans</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Blended Interest Rate
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            {debtSnapshot.blendedInterestRate !== null ? `${debtSnapshot.blendedInterestRate.toFixed(2)}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Excludes non-amortizing debt</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Debt-to-Asset Health
          </span>
          <p className={`mt-1 text-2xl font-black tracking-tight ${ratioTone(debtSnapshot.debtToAssetRatio)}`}>
            {debtSnapshot.debtToAssetRatio.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Liabilities vs. total assets</p>
        </div>
      </div>

      {/* Owner filter + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedOwner("ALL")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selectedOwner === "ALL"
                ? "bg-blue-600 text-white dark:bg-lime-400 dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
            }`}
          >
            All
          </button>
          {familyMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedOwner(m.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                selectedOwner === m.id
                  ? "bg-blue-600 text-white dark:bg-lime-400 dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={startAdd}
          className="focus-ring bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 dark:bg-lime-400 dark:text-slate-900 dark:hover:bg-lime-300"
        >
          + Add liability
        </button>
      </div>

      {/* Add/Edit form — category-aware fields */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-canvas-card sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {editingId ? `Editing ${form.name || "liability"}` : "Add a new liability"}
            </p>
            <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:underline dark:text-slate-400">
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Family member</label>
            <select
              value={form.familyMemberId}
              onChange={(e) => setForm((f) => ({ ...f, familyMemberId: e.target.value }))}
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
              value={form.liabilityType}
              onChange={(e) => setForm((f) => ({ ...f, liabilityType: e.target.value as LiabilityTypeValue }))}
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
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ICICI Home Loan, HDFC Regalia Card…"
              className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">
              {isCreditCard ? "Statement balance" : "Outstanding balance"}
            </label>
            <div className="mt-1 flex gap-1">
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
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
                value={form.outstandingBalance}
                onChange={(e) => setForm((f) => ({ ...f, outstandingBalance: e.target.value }))}
                placeholder="250000"
                className="focus-ring w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">
              {isCreditCard ? "Card last 4 digits (optional)" : "Account / Reference (optional)"}
            </label>
            <input
              value={form.accountReference}
              onChange={(e) => setForm((f) => ({ ...f, accountReference: e.target.value }))}
              placeholder={isCreditCard ? "4821" : "Loan A/C: 0048-HL-91024"}
              className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            />
          </div>

          {isCreditCard ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Statement due day (optional)</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.statementDueDay}
                  onChange={(e) => setForm((f) => ({ ...f, statementDueDay: e.target.value }))}
                  placeholder="e.g. 18"
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Interest rate % (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.interestRate}
                  onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))}
                  placeholder="Leave blank if paid in full each cycle"
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Monthly EMI (optional)</label>
                <input
                  type="number"
                  value={form.emiAmount}
                  onChange={(e) => setForm((f) => ({ ...f, emiAmount: e.target.value }))}
                  placeholder="Leave blank for Auto-Pay Full Clearance"
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Original amount (optional)</label>
                <input
                  type="number"
                  value={form.originalAmount}
                  onChange={(e) => setForm((f) => ({ ...f, originalAmount: e.target.value }))}
                  placeholder="For payoff progress %"
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Interest rate % (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.interestRate}
                  onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))}
                  placeholder="0 for 0% EMI"
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Monthly EMI (optional)</label>
                <input
                  type="number"
                  value={form.emiAmount}
                  onChange={(e) => setForm((f) => ({ ...f, emiAmount: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Target payoff date (optional)</label>
                <input
                  type="date"
                  value={form.targetPayoffDate}
                  onChange={(e) => setForm((f) => ({ ...f, targetPayoffDate: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
            </>
          )}

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="focus-ring w-full bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {loading ? "Saving…" : editingId ? "Save changes" : "Add"}
            </button>
          </div>
          {error && <p className="sm:col-span-2 lg:col-span-4 text-sm text-amber-600 dark:text-amber-400">{error}</p>}
        </form>
      )}

      {/* Category accordion */}
      <div className="space-y-3">
        {LIABILITY_CATEGORIES.map((cat) => {
          const rows = filtered.filter((l) => (cat.types as string[]).includes(l.liabilityType));
          const Icon = ICONS[cat.icon] ?? Layers;
          const isOpen = !!expandedCategories[cat.id];
          const catBaseRows = rows.filter((r) => r.currency === baseCurrency);
          const balanceSubtotal = catBaseRows.reduce((sum, r) => sum + Number(r.outstandingBalance), 0);
          const emiSubtotal = catBaseRows.reduce((sum, r) => sum + (r.emiAmount ? Number(r.emiAmount) : 0), 0);

          return (
            <div key={cat.id} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card">
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="focus-ring flex w-full items-center justify-between px-4 py-3 text-left"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                    <Icon size={16} />
                  </span>
                  <span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{cat.label}</span>
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400">
                        {rows.length}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{cat.subtitle}</span>
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-right">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                      {baseCurrency} {fmt(balanceSubtotal)}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {emiSubtotal > 0 ? `${baseCurrency} ${fmt(emiSubtotal)}/mo EMI` : "no EMI set"}
                    </span>
                  </span>
                  <ChevronRight size={16} className={`text-slate-400 transition-transform dark:text-slate-500 ${isOpen ? "rotate-90" : ""}`} />
                </span>
              </button>

              {isOpen && (
                <div className="overflow-x-auto border-t border-slate-200/80 dark:border-slate-800">
                  {rows.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">No liabilities in this category yet.</p>
                  ) : (
                    <LiabilityCategoryTable
                      rows={rows}
                      categoryId={cat.id}
                      inspectedId={inspectedId}
                      onToggleInspect={(id) => setInspectedId((prev) => (prev === id ? null : id))}
                      onEdit={startEdit}
                      onDelete={handleDelete}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RowActions({ l, onEdit, onDelete }: { l: LiabilityRow; onEdit: (l: LiabilityRow) => void; onDelete: (id: string) => void }) {
  return (
    <td className="px-4 py-2 text-right">
      <div className="flex items-center justify-end gap-3">
        <button onClick={() => onEdit(l)} aria-label="Edit" className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(l.id)} className="text-xs text-amber-600 hover:underline dark:text-amber-400">
          Remove
        </button>
      </div>
    </td>
  );
}

function InspectButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-lime-400"
    >
      Inspect
      <ChevronRight size={12} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
    </button>
  );
}

function LiabilityCategoryTable({
  rows,
  categoryId,
  inspectedId,
  onToggleInspect,
  onEdit,
  onDelete,
}: {
  rows: LiabilityRow[];
  categoryId: string;
  inspectedId: string | null;
  onToggleInspect: (id: string) => void;
  onEdit: (l: LiabilityRow) => void;
  onDelete: (id: string) => void;
}) {
  if (categoryId === "mortgages") {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400">
            <th className="px-4 py-2 font-medium">Loan Facility &amp; A/C Reference</th>
            <th className="px-2 py-2 font-medium">Borrower</th>
            <th className="px-2 py-2 text-right font-medium">Original Principal</th>
            <th className="px-2 py-2 text-right font-medium">Current Balance</th>
            <th className="px-2 py-2 text-right font-medium">Interest Rate</th>
            <th className="px-2 py-2 text-right font-medium">Monthly EMI</th>
            <th className="px-2 py-2 font-medium">Payoff Date</th>
            <th className="px-2 py-2"></th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const isInspectOpen = inspectedId === l.id;
            const breakdown = isAmortizing(l)
              ? computeAmortization({
                  outstandingBalance: Number(l.outstandingBalance),
                  originalAmount: l.originalAmount ? Number(l.originalAmount) : null,
                  interestRate: l.interestRate ? Number(l.interestRate) : null,
                  emiAmount: l.emiAmount ? Number(l.emiAmount) : null,
                  targetPayoffDate: l.targetPayoffDate ? new Date(l.targetPayoffDate) : null,
                })
              : null;
            return (
              <Fragment key={l.id}>
                <tr className="border-t border-slate-100 dark:border-slate-800/60">
                  <td className="px-4 py-2 text-slate-900 dark:text-white">
                    {l.name}
                    {l.accountReference && (
                      <span className="block text-slate-400 dark:text-slate-500">{l.accountReference}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{l.familyMemberName}</td>
                  <td className="px-2 py-2 text-right text-slate-500 dark:text-slate-400">
                    {l.originalAmount ? `${l.currency} ${fmt(Number(l.originalAmount))}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right font-medium text-slate-900 dark:text-white">
                    {l.currency} {fmt(Number(l.outstandingBalance))}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-500 dark:text-slate-400">
                    {l.interestRate ? `${l.interestRate}%` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-500 dark:text-slate-400">
                    {l.emiAmount ? `${l.currency} ${fmt(Number(l.emiAmount))}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-slate-500 dark:text-slate-400">
                    {fmtDate(l.targetPayoffDate)}
                    {breakdown?.monthsRemaining != null && (
                      <span className="ml-1 text-slate-400 dark:text-slate-500">({breakdown.monthsRemaining} EMIs left)</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {breakdown?.isAmortizing && <InspectButton isOpen={isInspectOpen} onClick={() => onToggleInspect(l.id)} />}
                  </td>
                  <RowActions l={l} onEdit={onEdit} onDelete={onDelete} />
                </tr>
                {isInspectOpen && breakdown?.isAmortizing && (
                  <tr className="border-t border-slate-100 bg-slate-50 dark:border-slate-800/60 dark:bg-white/5">
                    <td colSpan={9} className="px-4 py-3">
                      <LiabilityAmortizationPanel
                        currency={l.currency}
                        outstandingBalance={l.outstandingBalance}
                        originalAmount={l.originalAmount}
                        interestRate={l.interestRate}
                        emiAmount={l.emiAmount}
                        targetPayoffDate={l.targetPayoffDate}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (categoryId === "consumer") {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400">
            <th className="px-4 py-2 font-medium">Provider / Item</th>
            <th className="px-2 py-2 font-medium">Borrower</th>
            <th className="px-2 py-2 text-right font-medium">Financed Balance</th>
            <th className="px-2 py-2 text-right font-medium">Installment Amount</th>
            <th className="px-2 py-2 text-right font-medium">Months Remaining</th>
            <th className="px-2 py-2 text-right font-medium">APR</th>
            <th className="px-2 py-2"></th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const isInspectOpen = inspectedId === l.id;
            const amortizing = isAmortizing(l);
            const breakdown = amortizing
              ? computeAmortization({
                  outstandingBalance: Number(l.outstandingBalance),
                  originalAmount: l.originalAmount ? Number(l.originalAmount) : null,
                  interestRate: l.interestRate ? Number(l.interestRate) : null,
                  emiAmount: l.emiAmount ? Number(l.emiAmount) : null,
                  targetPayoffDate: l.targetPayoffDate ? new Date(l.targetPayoffDate) : null,
                })
              : null;
            return (
              <Fragment key={l.id}>
                <tr className="border-t border-slate-100 dark:border-slate-800/60">
                  <td className="px-4 py-2 text-slate-900 dark:text-white">
                    {l.name}
                    {l.accountReference && (
                      <span className="block text-slate-400 dark:text-slate-500">{l.accountReference}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{l.familyMemberName}</td>
                  <td className="px-2 py-2 text-right font-medium text-slate-900 dark:text-white">
                    {l.currency} {fmt(Number(l.outstandingBalance))}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-500 dark:text-slate-400">
                    {l.emiAmount ? `${l.currency} ${fmt(Number(l.emiAmount))}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-500 dark:text-slate-400">
                    {breakdown?.monthsRemaining ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-500 dark:text-slate-400">
                    {l.interestRate && Number(l.interestRate) > 0 ? `${l.interestRate}%` : "0% Fixed"}
                  </td>
                  <td className="px-2 py-2">
                    {amortizing && <InspectButton isOpen={isInspectOpen} onClick={() => onToggleInspect(l.id)} />}
                  </td>
                  <RowActions l={l} onEdit={onEdit} onDelete={onDelete} />
                </tr>
                {isInspectOpen && amortizing && (
                  <tr className="border-t border-slate-100 bg-slate-50 dark:border-slate-800/60 dark:bg-white/5">
                    <td colSpan={8} className="px-4 py-3">
                      <LiabilityAmortizationPanel
                        currency={l.currency}
                        outstandingBalance={l.outstandingBalance}
                        originalAmount={l.originalAmount}
                        interestRate={l.interestRate}
                        emiAmount={l.emiAmount}
                        targetPayoffDate={l.targetPayoffDate}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (categoryId === "credit-cards") {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400">
            <th className="px-4 py-2 font-medium">Card Issuer</th>
            <th className="px-2 py-2 font-medium">Cardholder</th>
            <th className="px-2 py-2 text-right font-medium">Running Statement Balance</th>
            <th className="px-2 py-2 font-medium">Statement Due Day</th>
            <th className="px-2 py-2 font-medium"></th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800/60">
              <td className="px-4 py-2 text-slate-900 dark:text-white">
                {l.name}
                {l.accountReference && (
                  <span className="block text-slate-400 dark:text-slate-500">••{l.accountReference}</span>
                )}
              </td>
              <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{l.familyMemberName}</td>
              <td className="px-2 py-2 text-right font-medium text-slate-900 dark:text-white">
                {l.currency} {fmt(Number(l.outstandingBalance))}
              </td>
              <td className="px-2 py-2 text-slate-500 dark:text-slate-400">
                {l.statementDueDay ? `Day ${l.statementDueDay}` : "—"}
              </td>
              <td className="px-2 py-2">
                {!l.emiAmount && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    Auto-Pay Full Clearance
                  </span>
                )}
              </td>
              <RowActions l={l} onEdit={onEdit} onDelete={onDelete} />
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // "other"
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-slate-500 dark:text-slate-400">
          <th className="px-4 py-2 font-medium">Name</th>
          <th className="px-2 py-2 font-medium">Borrower</th>
          <th className="px-2 py-2 text-right font-medium">Balance</th>
          <th className="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((l) => (
          <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800/60">
            <td className="px-4 py-2 text-slate-900 dark:text-white">{l.name}</td>
            <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{l.familyMemberName}</td>
            <td className="px-2 py-2 text-right font-medium text-slate-900 dark:text-white">
              {l.currency} {fmt(Number(l.outstandingBalance))}
            </td>
            <RowActions l={l} onEdit={onEdit} onDelete={onDelete} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
