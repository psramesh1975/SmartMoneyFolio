import type { MonthlyCategoryTypeValue } from "@/lib/monthly-types";

// Shared by the Monthly Base table's category tag, the CategoryCombobox
// dropdown, and the Manage Categories panel, so the Income/Outflow tint
// looks identical everywhere it appears.
export function categoryBadgeTone(type: MonthlyCategoryTypeValue | undefined): string {
  if (type === "INCOME") return "bg-growth/15 text-growth";
  if (type === "OUTFLOW") return "bg-coral/15 text-coral";
  return "bg-paper-2 text-ink-2";
}
