import type { MonthlyCategoryTypeValue } from "@/lib/monthly-types";

// Shared by the Monthly Base table's category tag, the CategoryCombobox
// dropdown, and the Manage Categories panel, so the Income/Outflow tint
// looks identical everywhere it appears.
export function categoryBadgeTone(type: MonthlyCategoryTypeValue | undefined): string {
  if (type === "INCOME") return "bg-emerald-600/15 text-emerald-700 dark:bg-cyan-400/15 dark:text-cyan-300";
  if (type === "OUTFLOW") return "bg-rose-600/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300";
  return "bg-slate-500/15 text-slate-600 dark:bg-slate-300/15 dark:text-slate-300";
}
