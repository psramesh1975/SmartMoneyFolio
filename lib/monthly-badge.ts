import type { MonthlyCategoryTypeValue } from "@/lib/monthly-types";

// Shared by the Monthly Base table's category tag, the CategoryCombobox
// dropdown, and the Manage Categories panel, so the Income/Outflow tint
// looks identical everywhere it appears.
export function categoryBadgeTone(type: MonthlyCategoryTypeValue | undefined): string {
  if (type === "INCOME") return "bg-emerald-600/15 text-emerald-700 dark:bg-cyan-400/15 dark:text-cyan-300";
  if (type === "OUTFLOW") return "bg-rose-600/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300";
  return "bg-slate-500/15 text-slate-600 dark:bg-slate-300/15 dark:text-slate-300";
}

// The auto-linked "Active SIP" / "EMI" badges on Monthly Base's read-only
// Debt/SIP rows — tinted distinctly from the Income/Outflow tones above so
// the two families of badge never get visually confused.
export function linkedBadgeTone(kind: "EMI" | "SIP"): string {
  if (kind === "SIP") return "bg-violet-600/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300";
  return "bg-amber-600/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300";
}
