"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark,
  TrendingUp,
  Coins,
  ShieldCheck,
  Wallet,
  Home,
  Layers,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { CURRENCIES } from "@/lib/currencies";
import { ASSET_CLASSES, assetClassLabel, type AssetClassValue } from "@/lib/asset-classes";
import { ASSET_CATEGORIES } from "@/lib/asset-categories";
import { computeFdCurrentValue, daysUntilMaturity } from "@/lib/fd-accrual";
import AssetAutocomplete, { type SecurityResult } from "@/components/AssetAutocomplete";
import ImportExcelModal from "@/components/ImportExcelModal";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Landmark,
  TrendingUp,
  Coins,
  ShieldCheck,
  Wallet,
  Home,
  Layers,
};

type FamilyMemberOption = { id: string; name: string };

export type AssetRow = {
  id: string;
  familyMemberId: string;
  familyMemberName: string;
  assetClass: AssetClassValue;
  holdingName: string;
  currency: string;
  currentValue: string;
  purchaseValue: string | null;
  accountOrFolioNo: string | null;
  securityId: string | null;
  securityName: string | null;
  securityTickerOrCode: string | null;
  securityLastPrice: string | null;
  unitsHeld: string | null;
  avgBuyPrice: string | null;
  interestRatePct: string | null;
  startDate: string | null;
  maturityDate: string | null;
  compoundingFrequency: string | null;
  autoRenewalType: string | null;
  isTaxExempt: boolean | null;
  sipMonthlyAmount: string | null;
};

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Live current value for a row, following each category's own convention —
// none of this is written back to the stored currentValue field; it's
// computed fresh on every render, same approach as the Debt table's
// amortization breakdown.
function liveValue(a: AssetRow): number {
  if (a.assetClass === "FIXED_DEPOSIT" && a.interestRatePct && a.startDate && a.compoundingFrequency) {
    const principal = Number(a.purchaseValue ?? a.currentValue);
    return computeFdCurrentValue({
      principal,
      interestRatePct: Number(a.interestRatePct),
      startDate: new Date(a.startDate),
      compoundingFrequency: a.compoundingFrequency as any,
    });
  }
  if ((a.assetClass === "MUTUAL_FUNDS" || a.assetClass === "STOCKS") && a.unitsHeld) {
    const price = a.securityLastPrice ?? a.avgBuyPrice;
    if (price) return Number(a.unitsHeld) * Number(price);
  }
  return Number(a.currentValue);
}

const COMPOUNDING_OPTIONS = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-yearly" },
  { value: "ANNUAL", label: "Annual" },
  { value: "AT_MATURITY", label: "At maturity" },
] as const;

const AUTO_RENEWAL_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "PAYOUT_TO_ACCOUNT", label: "Payout to account" },
  { value: "RENEW_PRINCIPAL_ONLY", label: "Renew principal only" },
  { value: "RENEW_PRINCIPAL_AND_INTEREST", label: "Renew principal + interest" },
] as const;

type FormState = {
  familyMemberId: string;
  assetClass: AssetClassValue;
  holdingName: string;
  currency: string;
  currentValue: string;
  purchaseValue: string;
  accountOrFolioNo: string;
  securityId: string | null;
  unitsHeld: string;
  avgBuyPrice: string;
  interestRatePct: string;
  startDate: string;
  maturityDate: string;
  compoundingFrequency: string;
  autoRenewalType: string;
  isTaxExempt: boolean;
};

function emptyForm(defaultMemberId: string): FormState {
  return {
    familyMemberId: defaultMemberId,
    assetClass: "CASH",
    holdingName: "",
    currency: "USD",
    currentValue: "",
    purchaseValue: "",
    accountOrFolioNo: "",
    securityId: null,
    unitsHeld: "",
    avgBuyPrice: "",
    interestRatePct: "",
    startDate: "",
    maturityDate: "",
    compoundingFrequency: "MONTHLY",
    autoRenewalType: "NONE",
    isTaxExempt: false,
  };
}

export default function AssetsClient({
  familyMembers,
  initialAssets,
  baseCurrency,
}: {
  familyMembers: FamilyMemberOption[];
  initialAssets: AssetRow[];
  baseCurrency: string;
}) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(familyMembers[0]?.id ?? ""));

  const [selectedOwner, setSelectedOwner] = useState<string>("ALL");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ "fixed-deposits": true });

  const filtered = selectedOwner === "ALL" ? assets : assets.filter((a) => a.familyMemberId === selectedOwner);
  const baseCurrencyRows = filtered.filter((a) => a.currency === baseCurrency);

  const totalTracked = baseCurrencyRows.reduce((sum, a) => sum + liveValue(a), 0);
  // Mirrors lib/asset-classes.ts's ASSET_GROUPS split (SGB sits with FIXED_DEPOSIT
  // as "Fixed Capital & Guaranteed" there too) so this page's scorecard agrees
  // with the dashboard's own grouping of the same asset classes.
  const fixedGuaranteedClasses: AssetClassValue[] = ["FIXED_DEPOSIT", "GOLD", "SGB", "GOVERNMENT_SCHEME", "CASH"];
  const marketGrowthClasses: AssetClassValue[] = ["MUTUAL_FUNDS", "STOCKS", "BONDS", "CRYPTOCURRENCY"];
  const totalFixed = baseCurrencyRows
    .filter((a) => fixedGuaranteedClasses.includes(a.assetClass))
    .reduce((sum, a) => sum + liveValue(a), 0);
  const totalMarket = baseCurrencyRows
    .filter((a) => marketGrowthClasses.includes(a.assetClass))
    .reduce((sum, a) => sum + liveValue(a), 0);

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

  function startEdit(a: AssetRow) {
    setEditingId(a.id);
    setForm({
      familyMemberId: a.familyMemberId,
      assetClass: a.assetClass,
      holdingName: a.holdingName,
      currency: a.currency,
      currentValue: a.currentValue,
      purchaseValue: a.purchaseValue ?? "",
      accountOrFolioNo: a.accountOrFolioNo ?? "",
      securityId: a.securityId,
      unitsHeld: a.unitsHeld ?? "",
      avgBuyPrice: a.avgBuyPrice ?? "",
      interestRatePct: a.interestRatePct ?? "",
      startDate: a.startDate ? a.startDate.slice(0, 10) : "",
      maturityDate: a.maturityDate ? a.maturityDate.slice(0, 10) : "",
      compoundingFrequency: a.compoundingFrequency ?? "MONTHLY",
      autoRenewalType: a.autoRenewalType ?? "NONE",
      isTaxExempt: a.isTaxExempt ?? false,
    });
    setError(null);
    setShowForm(true);
  }

  function handleSecuritySelect(security: SecurityResult) {
    setForm((f) => ({
      ...f,
      holdingName: security.name,
      securityId: security.id,
      accountOrFolioNo: f.accountOrFolioNo || security.tickerOrCode,
      avgBuyPrice: f.avgBuyPrice || (security.lastPrice ? String(Number(security.lastPrice)) : f.avgBuyPrice),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.familyMemberId || !form.holdingName.trim()) {
      setError("Fill in the name and owner.");
      return;
    }

    const isMarket = form.assetClass === "MUTUAL_FUNDS" || form.assetClass === "STOCKS";
    const isFd = form.assetClass === "FIXED_DEPOSIT";
    const isSgb = form.assetClass === "SGB";

    // currentValue is required by the schema for every row — for the
    // specialized categories it's derived at write time as a sane snapshot;
    // the /assets page itself always re-derives the live value on render
    // rather than trusting this stored figure for those rows.
    let currentValue = form.currentValue;
    if (isMarket && form.unitsHeld && form.avgBuyPrice) {
      currentValue = String(Number(form.unitsHeld) * Number(form.avgBuyPrice));
    } else if (isSgb && form.unitsHeld && form.avgBuyPrice) {
      currentValue = String(Number(form.unitsHeld) * Number(form.avgBuyPrice));
    }
    if (!currentValue) {
      setError("Fill in a value for this asset.");
      return;
    }

    const payload: Record<string, unknown> = {
      familyMemberId: form.familyMemberId,
      assetClass: form.assetClass,
      holdingName: form.holdingName,
      currency: form.currency,
      currentValue,
    };
    if (form.assetClass === "REAL_ESTATE" && form.purchaseValue) payload.purchaseValue = form.purchaseValue;
    if (isMarket) {
      if (form.securityId) payload.securityId = form.securityId;
      if (form.accountOrFolioNo) payload.accountOrFolioNo = form.accountOrFolioNo;
      if (form.unitsHeld) payload.unitsHeld = form.unitsHeld;
      if (form.avgBuyPrice) payload.avgBuyPrice = form.avgBuyPrice;
    }
    if (isFd) {
      if (form.accountOrFolioNo) payload.accountOrFolioNo = form.accountOrFolioNo;
      if (form.interestRatePct) payload.interestRatePct = form.interestRatePct;
      if (form.startDate) payload.startDate = form.startDate;
      if (form.maturityDate) payload.maturityDate = form.maturityDate;
      if (form.compoundingFrequency) payload.compoundingFrequency = form.compoundingFrequency;
      if (form.autoRenewalType) payload.autoRenewalType = form.autoRenewalType;
      payload.isTaxExempt = form.isTaxExempt;
    }
    if (isSgb) {
      if (form.unitsHeld) payload.unitsHeld = form.unitsHeld;
      if (form.avgBuyPrice) payload.avgBuyPrice = form.avgBuyPrice;
      if (form.maturityDate) payload.maturityDate = form.maturityDate;
    }

    setLoading(true);
    try {
      const res = await fetch(editingId ? `/api/accounts/${editingId}` : "/api/accounts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that asset.");
        return;
      }
      // Simplest correct way to reflect a category-aware create/edit in the
      // list without hand-reconstructing every joined field client-side.
      router.refresh();
      resetForm();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    if (editingId === id) resetForm();
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const isMarket = form.assetClass === "MUTUAL_FUNDS" || form.assetClass === "STOCKS";
  const isFd = form.assetClass === "FIXED_DEPOSIT";
  const isSgb = form.assetClass === "SGB";
  const isSimple = !isMarket && !isFd && !isSgb;

  return (
    <div className="mt-8 space-y-8">
      {/* Macro scorecard */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total tracked assets
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-emerald-600 dark:text-cyan-400">
            {baseCurrency} {fmt(totalTracked)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{baseCurrencyRows.length} holdings</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Fixed guaranteed wealth
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-blue-600 dark:text-lime-400">
            {baseCurrency} {fmt(totalFixed)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {totalTracked > 0 ? Math.round((totalFixed / totalTracked) * 100) : 0}% of total
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Market growth capital
          </span>
          <p className="mt-1 text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            {baseCurrency} {fmt(totalMarket)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {totalTracked > 0 ? Math.round((totalMarket / totalTracked) * 100) : 0}% of total
          </p>
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="focus-ring bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Import from Excel
          </button>
          <button
            type="button"
            onClick={startAdd}
            className="focus-ring bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 dark:bg-lime-400 dark:text-slate-900 dark:hover:bg-lime-300"
          >
            + Add asset
          </button>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-canvas-card sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {editingId ? `Editing ${form.holdingName || "asset"}` : "Add a new asset"}
            </p>
            <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:underline dark:text-slate-400">
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Asset class</label>
            <select
              value={form.assetClass}
              onChange={(e) => setForm((f) => ({ ...f, assetClass: e.target.value as AssetClassValue }))}
              className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
            >
              {ASSET_CLASSES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Owner</label>
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

          {isMarket && (
            <>
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                  {form.assetClass === "MUTUAL_FUNDS" ? "Scheme name" : "Company / ticker"}
                </label>
                {editingId && form.securityId ? (
                  <input
                    value={form.holdingName}
                    onChange={(e) => setForm((f) => ({ ...f, holdingName: e.target.value }))}
                    className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                  />
                ) : (
                  <AssetAutocomplete
                    type={form.assetClass === "MUTUAL_FUNDS" ? "MUTUAL_FUND" : "STOCK"}
                    onSelect={handleSecuritySelect}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Folio / Ticker</label>
                <input
                  value={form.accountOrFolioNo}
                  onChange={(e) => setForm((f) => ({ ...f, accountOrFolioNo: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Units held</label>
                <input
                  type="number"
                  value={form.unitsHeld}
                  onChange={(e) => setForm((f) => ({ ...f, unitsHeld: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Avg buy price</label>
                <input
                  type="number"
                  value={form.avgBuyPrice}
                  onChange={(e) => setForm((f) => ({ ...f, avgBuyPrice: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
            </>
          )}

          {isFd && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Bank &amp; A/C number</label>
                <input
                  value={form.accountOrFolioNo}
                  onChange={(e) => setForm((f) => ({ ...f, accountOrFolioNo: e.target.value }))}
                  placeholder="HDFC Bank — 1234567890"
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Nickname</label>
                <input
                  value={form.holdingName}
                  onChange={(e) => setForm((f) => ({ ...f, holdingName: e.target.value }))}
                  placeholder="PFC FD"
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Principal</label>
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
                    value={form.currentValue}
                    onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))}
                    className="focus-ring w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Interest rate %</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.interestRatePct}
                  onChange={(e) => setForm((f) => ({ ...f, interestRatePct: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Start date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Maturity date</label>
                <input
                  type="date"
                  value={form.maturityDate}
                  onChange={(e) => setForm((f) => ({ ...f, maturityDate: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Compounding</label>
                <select
                  value={form.compoundingFrequency}
                  onChange={(e) => setForm((f) => ({ ...f, compoundingFrequency: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                >
                  {COMPOUNDING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Auto-renewal</label>
                <select
                  value={form.autoRenewalType}
                  onChange={(e) => setForm((f) => ({ ...f, autoRenewalType: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                >
                  {AUTO_RENEWAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isTaxExempt}
                  onChange={(e) => setForm((f) => ({ ...f, isTaxExempt: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                Tax-exempt (NRE FD, PPF, etc.)
              </label>
            </>
          )}

          {isSgb && (
            <>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Tranche series</label>
                <input
                  value={form.holdingName}
                  onChange={(e) => setForm((f) => ({ ...f, holdingName: e.target.value }))}
                  placeholder="SGB 2020-21 Series IV"
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Grams held</label>
                <input
                  type="number"
                  value={form.unitsHeld}
                  onChange={(e) => setForm((f) => ({ ...f, unitsHeld: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Issue price / gram</label>
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
                    value={form.avgBuyPrice}
                    onChange={(e) => setForm((f) => ({ ...f, avgBuyPrice: e.target.value }))}
                    className="focus-ring w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Maturity date</label>
                <input
                  type="date"
                  value={form.maturityDate}
                  onChange={(e) => setForm((f) => ({ ...f, maturityDate: e.target.value }))}
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
            </>
          )}

          {isSimple && (
            <>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Asset name</label>
                <input
                  value={form.holdingName}
                  onChange={(e) => setForm((f) => ({ ...f, holdingName: e.target.value }))}
                  placeholder="Checking Account, PPF, Family Home…"
                  className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Current value</label>
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
                    value={form.currentValue}
                    onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))}
                    className="focus-ring w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                  />
                </div>
              </div>
              {form.assetClass === "REAL_ESTATE" && (
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Purchase value (optional)</label>
                  <input
                    type="number"
                    value={form.purchaseValue}
                    onChange={(e) => setForm((f) => ({ ...f, purchaseValue: e.target.value }))}
                    className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
                  />
                </div>
              )}
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
        {ASSET_CATEGORIES.map((cat) => {
          const rows = filtered.filter((a) => (cat.classes as string[]).includes(a.assetClass));
          const Icon = ICONS[cat.icon] ?? Layers;
          const isOpen = !!expandedCategories[cat.id];
          const catBaseRows = rows.filter((r) => r.currency === baseCurrency);
          const subtotal = catBaseRows.reduce((sum, r) => sum + liveValue(r), 0);
          const pctOfTotal = totalTracked > 0 ? Math.round((subtotal / totalTracked) * 100) : 0;

          return (
            <div key={cat.id} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card">
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="focus-ring flex w-full items-center justify-between px-4 py-3 text-left"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 dark:border-lime-400/20 dark:bg-lime-400/10 dark:text-lime-400">
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
                      {baseCurrency} {fmt(subtotal)}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{pctOfTotal}% of portfolio</span>
                  </span>
                  <ChevronRight size={16} className={`text-slate-400 transition-transform dark:text-slate-500 ${isOpen ? "rotate-90" : ""}`} />
                </span>
              </button>

              {isOpen && (
                <div className="overflow-x-auto border-t border-slate-200/80 dark:border-slate-800">
                  {rows.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">No holdings in this category yet.</p>
                  ) : (
                    <CategoryTable rows={rows} categoryId={cat.id} onEdit={startEdit} onDelete={handleDelete} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ImportExcelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import assets from Excel"
        resourceLabelPlural="accounts"
        templateHref="/templates/assets-import-template.xlsx"
        validateUrl="/api/accounts/import/validate"
        importUrl="/api/accounts/import"
        onImported={() => {
          router.refresh();
        }}
      />
    </div>
  );
}

function CategoryTable({
  rows,
  categoryId,
  onEdit,
  onDelete,
}: {
  rows: AssetRow[];
  categoryId: string;
  onEdit: (a: AssetRow) => void;
  onDelete: (id: string) => void;
}) {
  if (categoryId === "fixed-deposits") {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400">
            <th className="px-4 py-2 font-medium">Bank &amp; A/C</th>
            <th className="px-2 py-2 font-medium">Owner</th>
            <th className="px-2 py-2 text-right font-medium">Principal</th>
            <th className="px-2 py-2 text-right font-medium">Rate</th>
            <th className="px-2 py-2 font-medium">Maturity</th>
            <th className="px-2 py-2 text-right font-medium">Current Value</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const principal = Number(a.purchaseValue ?? a.currentValue);
            const current = liveValue(a);
            const days = a.maturityDate ? daysUntilMaturity(new Date(a.maturityDate)) : null;
            return (
              <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800/60">
                <td className="px-4 py-2 text-slate-900 dark:text-white">{a.accountOrFolioNo || a.holdingName}</td>
                <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{a.familyMemberName}</td>
                <td className="px-2 py-2 text-right text-slate-900 dark:text-white">
                  {a.currency} {fmt(principal)}
                </td>
                <td className="px-2 py-2 text-right text-slate-500 dark:text-slate-400">
                  {a.interestRatePct ? `${a.interestRatePct}%` : "—"}
                </td>
                <td className="px-2 py-2 text-slate-500 dark:text-slate-400">
                  {fmtDate(a.maturityDate)}
                  {days !== null && <span className="ml-1 text-slate-400 dark:text-slate-500">({days}d)</span>}
                </td>
                <td className="px-2 py-2 text-right font-medium text-emerald-600 dark:text-cyan-400">
                  {a.currency} {fmt(current)}
                </td>
                <RowActions a={a} onEdit={onEdit} onDelete={onDelete} />
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (categoryId === "market") {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400">
            <th className="px-4 py-2 font-medium">Scheme / Company</th>
            <th className="px-2 py-2 font-medium">Folio / Ticker</th>
            <th className="px-2 py-2 font-medium">Owner</th>
            <th className="px-2 py-2 text-right font-medium">Units</th>
            <th className="px-2 py-2 text-right font-medium">Latest Price</th>
            <th className="px-2 py-2 text-right font-medium">Valuation</th>
            <th className="px-2 py-2 text-right font-medium">Gain/Loss</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const units = a.unitsHeld ? Number(a.unitsHeld) : null;
            const latestPrice = a.securityLastPrice ?? a.avgBuyPrice;
            const valuation = liveValue(a);
            const costBasis = units && a.avgBuyPrice ? units * Number(a.avgBuyPrice) : null;
            const gainPct = costBasis && costBasis > 0 ? ((valuation - costBasis) / costBasis) * 100 : null;
            return (
              <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800/60">
                <td className="px-4 py-2 text-slate-900 dark:text-white">{a.holdingName}</td>
                <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{a.accountOrFolioNo || "—"}</td>
                <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{a.familyMemberName}</td>
                <td className="px-2 py-2 text-right text-slate-900 dark:text-white">{units ?? "—"}</td>
                <td className="px-2 py-2 text-right text-slate-500 dark:text-slate-400">
                  {latestPrice ? `${a.currency} ${Number(latestPrice).toLocaleString()}` : "—"}
                </td>
                <td className="px-2 py-2 text-right font-medium text-slate-900 dark:text-white">
                  {a.currency} {fmt(valuation)}
                </td>
                <td
                  className={`px-2 py-2 text-right font-medium ${
                    gainPct === null ? "text-slate-400 dark:text-slate-500" : gainPct >= 0 ? "text-emerald-600 dark:text-cyan-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {gainPct === null ? "—" : `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%`}
                </td>
                <RowActions a={a} onEdit={onEdit} onDelete={onDelete} />
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (categoryId === "sgb") {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400">
            <th className="px-4 py-2 font-medium">Tranche Series</th>
            <th className="px-2 py-2 font-medium">Owner</th>
            <th className="px-2 py-2 text-right font-medium">Grams</th>
            <th className="px-2 py-2 text-right font-medium">Issue Price/g</th>
            <th className="px-2 py-2 font-medium">Maturity Year</th>
            <th className="px-2 py-2 text-right font-medium">Current Value</th>
            <th className="px-2 py-2 font-medium">Coupon</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800/60">
              <td className="px-4 py-2 text-slate-900 dark:text-white">{a.holdingName}</td>
              <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{a.familyMemberName}</td>
              <td className="px-2 py-2 text-right text-slate-900 dark:text-white">{a.unitsHeld ?? "—"}</td>
              <td className="px-2 py-2 text-right text-slate-500 dark:text-slate-400">
                {a.avgBuyPrice ? `${a.currency} ${Number(a.avgBuyPrice).toLocaleString()}` : "—"}
              </td>
              <td className="px-2 py-2 text-slate-500 dark:text-slate-400">
                {a.maturityDate ? new Date(a.maturityDate).getFullYear() : "—"}
              </td>
              <td className="px-2 py-2 text-right font-medium text-slate-900 dark:text-white">
                {a.currency} {fmt(liveValue(a))}
              </td>
              <td className="px-2 py-2 text-slate-500 dark:text-slate-400">2.5% p.a.</td>
              <RowActions a={a} onEdit={onEdit} onDelete={onDelete} />
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Pension & Insurance, Liquid Cash, Real Estate, Government Schemes & Other
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-slate-500 dark:text-slate-400">
          <th className="px-4 py-2 font-medium">Owner</th>
          <th className="px-2 py-2 font-medium">Name</th>
          <th className="px-2 py-2 font-medium">Asset Class</th>
          <th className="px-2 py-2 text-right font-medium">Current Value</th>
          <th className="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800/60">
            <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{a.familyMemberName}</td>
            <td className="px-2 py-2 text-slate-900 dark:text-white">{a.holdingName}</td>
            <td className="px-2 py-2 text-slate-500 dark:text-slate-400">{assetClassLabel(a.assetClass)}</td>
            <td className="px-2 py-2 text-right font-medium text-slate-900 dark:text-white">
              {a.currency} {fmt(Number(a.currentValue))}
            </td>
            <RowActions a={a} onEdit={onEdit} onDelete={onDelete} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RowActions({ a, onEdit, onDelete }: { a: AssetRow; onEdit: (a: AssetRow) => void; onDelete: (id: string) => void }) {
  return (
    <td className="px-4 py-2 text-right">
      <div className="flex items-center justify-end gap-3">
        <button onClick={() => onEdit(a)} aria-label="Edit" className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(a.id)} className="text-xs text-amber-600 hover:underline dark:text-amber-400">
          Remove
        </button>
      </div>
    </td>
  );
}
