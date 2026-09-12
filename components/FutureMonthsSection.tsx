// FutureMonthsSection.tsx
// Drop-in sidebar section for the "Future Months" accordion, matching the
// approved mockup. Inserted between the "Next Month" link and the
// "Earlier Months" link in ClientSidebar.tsx — the rest of the sidebar is
// untouched. Copied from the approved file as given, no layout changes.

'use client';

import { useState } from 'react';

export type DraftMonthStatus = 'draft' | 'active-draft';

export interface DraftMonth {
  label: string; // e.g. "November 2026"
  href: string;  // e.g. "/tracking/2026/november"
  status: DraftMonthStatus;
}

interface FutureMonthsSectionProps {
  draftMonths: DraftMonth[];
  onAddMonth?: () => void;
  defaultOpen?: boolean;
}

export default function FutureMonthsSection({
  draftMonths,
  onAddMonth,
  defaultOpen = true,
}: FutureMonthsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="pt-1">
      <button
        onClick={() => setOpen(!open)}
        className="bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20 px-2.5 py-1.5 rounded-lg w-full flex justify-between items-center text-xs"
      >
        <span className="flex items-center gap-2">🔮 Future Months</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="mt-1.5 space-y-1 pl-2 border-l border-slate-800/80 ml-3">
          {draftMonths.map((m) => {
            const isActive = m.status === 'active-draft';
            return (
              <a
                key={m.label}
                href={m.href}
                className={`flex items-center justify-between px-3 py-1.5 text-xs rounded-lg transition ${
                  isActive ? 'bg-indigo-900/60 text-white font-bold' : 'hover:text-white text-slate-400'
                }`}
              >
                <span>{m.label}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-amber-400 text-slate-900'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isActive ? 'Active Draft' : 'Draft'}
                </span>
              </a>
            );
          })}

          <button
            onClick={onAddMonth}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
          >
            + Add Another Month
          </button>
        </div>
      )}
    </div>
  );
}
