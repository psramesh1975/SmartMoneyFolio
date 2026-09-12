"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// The mockup's "Household" dropdown is really a family-member filter — our
// data model has one Household per tenant, with multiple FamilyMembers
// inside it. Selecting a member sets `?member=<id>` on the current URL;
// /dashboard reads that to scope Total Assets/Liabilities/Net Worth,
// Macro Allocation, the by-member grid, and Upcoming Debits to just that
// person (see lib/dashboard-data.ts's isMemberFiltered for what does and
// doesn't get narrowed — Monthly Tracking cash flow and Goals aren't
// member-scoped in the schema, so those stay household-wide regardless).
// Lives in the shared header, so the param harmlessly rides along on other
// routes until they're migrated to read it too.
export default function MemberFilterSelect({
  members,
}: {
  members: { id: string; name: string; relationship: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentId = searchParams.get("member") ?? "";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("member", value);
    } else {
      params.delete("member");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-canvas-card">
      <span className="mr-2 text-xs font-medium text-slate-400 dark:text-slate-500">Household:</span>
      <select
        className="cursor-pointer bg-transparent text-sm font-extrabold text-slate-900 focus:outline-none dark:text-white"
        value={currentId}
        onChange={handleChange}
      >
        <option value="">All Members (Consolidated)</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.relationship})
          </option>
        ))}
      </select>
    </div>
  );
}
