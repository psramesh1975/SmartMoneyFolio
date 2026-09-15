"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FlatBasePayload, MonthlyBaseAutoRowDTO, MonthlyBaseGeneralRowDTO } from "@/lib/monthly-types";
import { formatCurrency } from "@/lib/format-currency";

type Bucket = "income" | "expense";
type ManualRow = MonthlyBaseGeneralRowDTO & { pending?: boolean };

async function request(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
  return body;
}

function amount(rows: { baseAmount: string }[]) {
  return rows.reduce((total, row) => total + (Number(row.baseAmount) || 0), 0);
}

function instrument(row: MonthlyBaseAutoRowDTO) {
  if (row.kind === "SIP") return "Mutual Fund SIP";
  // Keep this component compatible with the committed MonthlyBaseAutoRowDTO.
  // The richer liability type is available in Claude's in-progress work,
  // but is not part of the shipped DTO yet.
  return "Loan EMI";
}

export default function MonthlyBaseReferenceClient({ payload, baseCurrency }: { payload: FlatBasePayload; baseCurrency: string }) {
  const router = useRouter();
  const [incomeRows, setIncomeRows] = useState<ManualRow[]>(payload.incomeRows);
  const [expenseRows, setExpenseRows] = useState<ManualRow[]>(payload.expenseRows);
  const [drafts, setDrafts] = useState<Record<Bucket, { name: string; amount: string }>>({
    income: { name: "", amount: "" },
    expense: { name: "", amount: "" },
  });
  const [error, setError] = useState<string | null>(null);
  const syncedRows = useMemo(() => [...payload.debtRows, ...payload.sipRows], [payload.debtRows, payload.sipRows]);

  const incomeTotal = amount(incomeRows);
  const livingTotal = amount(expenseRows);
  const syncedTotal = amount(syncedRows);
  const outflowTotal = syncedTotal + livingTotal;
  const buffer = incomeTotal - outflowTotal;
  const savingRate = incomeTotal > 0 ? (buffer / incomeTotal) * 100 : 0;

  async function add(bucket: Bucket) {
    const draft = drafts[bucket];
    const name = draft.name.trim();
    const baseAmount = Number(draft.amount);
    if (!name || !Number.isFinite(baseAmount) || baseAmount < 0) {
      setError("Enter an item name and a valid non-negative amount.");
      return;
    }
    setError(null);
    try {
      const data = await request("/api/monthly/line-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: bucket, name, baseAmount }),
      });
      const row: ManualRow = { id: data.lineItem.id, name, baseAmount: String(baseAmount), categoryId: data.lineItem.categoryId, scheduleDay: null, paymentMethod: null };
      if (bucket === "income") setIncomeRows((rows) => [...rows, row]);
      else setExpenseRows((rows) => [...rows, row]);
      setDrafts((current) => ({ ...current, [bucket]: { name: "", amount: "" } }));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this item.");
    }
  }

  async function remove(bucket: Bucket, id: string) {
    setError(null);
    const update = bucket === "income" ? setIncomeRows : setExpenseRows;
    const before = bucket === "income" ? incomeRows : expenseRows;
    update((rows) => rows.filter((row) => row.id !== id));
    try {
      await request(`/api/monthly/line-items/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (cause) {
      update(before);
      setError(cause instanceof Error ? cause.message : "Could not remove this item.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">Master Blueprint</span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">100% {baseCurrency}</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Monthly Baseline Setup</h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm dark:text-slate-400">Enter your fixed monthly routine once. This automatically initializes each month without re-typing.</p>
        </div>
        <div className="self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-canvas-card dark:text-slate-300">Household: <strong className="text-slate-900 dark:text-white">Consolidated</strong></div>
      </header>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">{error}</p>}

      <section className="grid grid-cols-1 gap-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-canvas-card">
        <Metric label="1. Total Inflow" value={incomeTotal} currency={baseCurrency} tone="text-emerald-600" detail="Regular baseline receipts" />
        <Metric label="2. Total Baseline Outflow" value={outflowTotal} currency={baseCurrency} tone="text-rose-600" detail={`${formatCurrency(syncedTotal, baseCurrency)} Synced + ${formatCurrency(livingTotal, baseCurrency)} Living`} className="pt-3 sm:pl-5 sm:pt-0" />
        <Metric label="3. Monthly Buffer" value={buffer} currency={baseCurrency} tone="text-indigo-600" detail={`${savingRate.toFixed(1)}% Net Saved`} className="pt-3 sm:pl-5 sm:pt-0" />
      </section>

      <ManualBucket bucket="income" title="Money In (Income & Inflows)" rows={incomeRows} total={incomeTotal} currency={baseCurrency} draft={drafts.income} onDraft={(draft) => setDrafts((current) => ({ ...current, income: draft }))} onAdd={() => add("income")} onRemove={(id) => remove("income", id)} />
      <SyncedBucket rows={syncedRows} total={syncedTotal} currency={baseCurrency} />
      <ManualBucket bucket="expense" title="Monthly Base Living (Bills & Household)" rows={expenseRows} total={livingTotal} currency={baseCurrency} draft={drafts.expense} onDraft={(draft) => setDrafts((current) => ({ ...current, expense: draft }))} onAdd={() => add("expense")} onRemove={(id) => remove("expense", id)} />
    </div>
  );
}

function Metric({ label, value, currency, tone, detail, className = "" }: { label: string; value: number; currency: string; tone: string; detail: string; className?: string }) {
  return <div className={className}><span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span><div className={`font-mono text-2xl font-extrabold ${tone}`}>{formatCurrency(value, currency)}</div><span className="text-xs text-slate-400 dark:text-slate-500">{detail}</span></div>;
}

function ManualBucket({ bucket, title, rows, total, currency, draft, onDraft, onAdd, onRemove }: { bucket: Bucket; title: string; rows: ManualRow[]; total: number; currency: string; draft: { name: string; amount: string }; onDraft: (draft: { name: string; amount: string }) => void; onAdd: () => void; onRemove: (id: string) => void }) {
  const isIncome = bucket === "income";
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card"><div className="flex items-center justify-between gap-3 bg-slate-900 p-4 text-white dark:bg-slate-950"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isIncome ? "bg-emerald-400" : "bg-amber-400"}`} /><h2 className="text-xs font-bold uppercase tracking-wider">{title}</h2></div><span className="whitespace-nowrap font-mono text-xs text-slate-300">Total: <strong className="text-white">{formatCurrency(total, currency)}</strong></span></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{rows.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">{isIncome ? "No recurring income yet." : "No recurring living expenses yet."}</p> : rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/5"><div><p className="text-sm font-bold text-slate-900 dark:text-white">{row.name}</p><p className="text-xs text-slate-400">{row.paymentMethod || "Regular Blueprint Item"}</p></div><div className="flex items-center gap-4"><span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(row.baseAmount, currency)}</span><button type="button" aria-label={`Remove ${row.name}`} onClick={() => onRemove(row.id)} className="text-sm text-slate-400 hover:text-rose-600">✕</button></div></div>)}</div><form onSubmit={(event) => { event.preventDefault(); onAdd(); }} className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 p-3 px-5 sm:flex-row dark:border-slate-800 dark:bg-white/5"><input value={draft.name} onChange={(event) => onDraft({ ...draft, name: event.target.value })} placeholder={isIncome ? "Add source (e.g., Rental, Freelance)" : "Expense description (e.g., Wifi, Cook Salary, School Bus)"} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 dark:border-slate-700 dark:bg-canvas-card dark:text-white" /><input value={draft.amount} onChange={(event) => onDraft({ ...draft, amount: event.target.value })} type="number" min="0" step="any" placeholder={`Amount (${currency})`} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 sm:w-32 dark:border-slate-700 dark:bg-canvas-card dark:text-white" /><button type="submit" className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">+ Add</button></form></section>;
}

function SyncedBucket({ rows, total, currency }: { rows: MonthlyBaseAutoRowDTO[]; total: number; currency: string }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-canvas-card"><div className="flex items-center justify-between gap-3 bg-slate-900 p-4 text-white dark:bg-slate-950"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-400" /><h2 className="text-xs font-bold uppercase tracking-wider">Auto-Synced Commitments (Loans & SIPs)</h2><span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-medium text-indigo-200">Automatic</span></div><span className="whitespace-nowrap font-mono text-xs text-slate-300">Total: <strong className="text-white">{formatCurrency(total, currency)}</strong></span></div><div className="flex items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50/50 px-5 py-3 text-xs text-indigo-900 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200"><span>Pulled directly from your active folios in Assets &amp; Liabilities. Update values there.</span><span className="whitespace-nowrap text-[11px] font-bold text-indigo-600 dark:text-indigo-300">{rows.length} {rows.length === 1 ? "Item" : "Items"} Synced 🔒</span></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{rows.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">No active loan EMIs or SIPs yet.</p> : rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/5"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-slate-900 dark:text-white">{row.name}</p><span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${row.kind === "SIP" ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300"}`}>{instrument(row)}</span></div><Link href={row.kind === "SIP" ? "/assets" : "/liabilities"} className="text-xs text-slate-400 hover:text-indigo-600 hover:underline">Synced from {row.kind === "SIP" ? "Assets" : "Liabilities"} ↗</Link></div><span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(row.baseAmount, currency)}</span></div>)}</div></section>;
}
