"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/currencies";
import { ASSET_CLASSES, assetClassLabel } from "@/lib/asset-classes";
import ImportExcelModal from "@/components/ImportExcelModal";
import type { ImportMode } from "@/lib/import/types";

type FamilyMemberOption = { id: string; name: string };

type AccountRow = {
  id: string;
  familyMemberId: string;
  familyMemberName: string;
  assetClass: string;
  holdingName: string;
  currency: string;
  currentValue: string;
};

export default function AccountsClient({
  familyMembers,
  initialAccounts,
}: {
  familyMembers: FamilyMemberOption[];
  initialAccounts: AccountRow[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [familyMemberId, setFamilyMemberId] = useState(familyMembers[0]?.id ?? "");
  const [assetClass, setAssetClass] = useState(ASSET_CLASSES[0].value);
  const [holdingName, setHoldingName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [currentValue, setCurrentValue] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!familyMemberId || !holdingName.trim() || !currentValue) {
      setError("Fill in the holding name, value, and family member.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyMemberId, assetClass, holdingName, currency, currentValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't add that account.");
        return;
      }
      const member = familyMembers.find((m) => m.id === familyMemberId);
      setAccounts((prev) => [
        ...prev,
        {
          id: data.account.id,
          familyMemberId,
          familyMemberName: member?.name ?? "",
          assetClass,
          holdingName,
          currency,
          currentValue,
        },
      ]);
      setHoldingName("");
      setCurrentValue("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="focus-ring bg-folio px-4 py-2 text-base text-paper hover:bg-folio-light"
        >
          Import from Excel
        </button>
      </div>
      <form
          onSubmit={handleAdd}
          className="grid grid-cols-1 gap-3 border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div>
            <label className="block text-sm font-medium text-ink-2">Family member</label>
            <select
              value={familyMemberId}
              onChange={(e) => setFamilyMemberId(e.target.value)}
              className="focus-ring mt-1 w-full border border-line bg-white px-2 py-2 text-base text-ink"
            >
              {familyMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2">Asset class</label>
            <select
              value={assetClass}
              onChange={(e) => setAssetClass(e.target.value as typeof assetClass)}
              className="focus-ring mt-1 w-full border border-line bg-white px-2 py-2 text-base text-ink"
            >
              {ASSET_CLASSES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2">Holding name</label>
            <input
              value={holdingName}
              onChange={(e) => setHoldingName(e.target.value)}
              placeholder="PFC FD, Nippon Small Cap…"
              className="focus-ring mt-1 w-full border border-line bg-white px-2 py-2 text-base text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2">Value</label>
            <div className="mt-1 flex gap-1">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="focus-ring w-20 border border-line bg-white px-1 py-2 text-base text-ink"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="500000"
                className="focus-ring w-full border border-line bg-white px-2 py-2 text-base text-ink"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="focus-ring w-full bg-ink px-4 py-2 text-base text-paper hover:bg-ink-2 disabled:opacity-60"
            >
              {loading ? "Adding…" : "Add"}
            </button>
          </div>
          {error && (
            <p className="sm:col-span-2 lg:col-span-5 text-base text-amber">{error}</p>
          )}
        </form>

      <div className="divide-y divide-line border border-line bg-white">
        {accounts.length === 0 && (
          <p className="px-4 py-6 text-base text-ink-2">
            No holdings added yet. Use the form above to add your first one.
          </p>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-base font-medium text-ink">{a.holdingName}</p>
              <p className="text-sm text-ink-2">
                {a.familyMemberName} · {assetClassLabel(a.assetClass)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-base text-ink">
                {a.currency} {Number(a.currentValue).toLocaleString()}
              </span>
              <button
                onClick={() => handleDelete(a.id)}
                className="text-xs text-amber hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <ImportExcelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import holdings from Excel"
        resourceLabelPlural="accounts"
        templateHref="/templates/holdings-import-template.xlsx"
        validateUrl="/api/accounts/import/validate"
        importUrl="/api/accounts/import"
        onImported={(result, mode: ImportMode) => {
          const items = (result as { items: typeof accounts }).items;
          setAccounts((prev) => (mode === "replace" ? items : [...prev, ...items]));
          router.refresh();
        }}
      />
    </div>
  );
}
