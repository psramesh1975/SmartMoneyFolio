"use client";

import { useEffect, useState } from "react";

// Three plain <select> dropdowns instead of the native <input type="date">'s
// calendar widget — jumping straight to a year dropdown is far less painful
// than scrolling a browser calendar back 30-40 years for a date of birth.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function DateOfBirthPicker({
  value,
  onChange,
}: {
  value: string; // "YYYY-MM-DD" once complete, "" until then
  onChange: (value: string) => void;
}) {
  // Each dropdown keeps its own local state rather than deriving from
  // `value` on every render — `value` (and thus onChange) is only ever a
  // complete "YYYY-MM-DD" or "", so deriving Day/Month/Year purely from it
  // would reset every dropdown back to blank the instant one is picked
  // (the combined date isn't complete yet, so the parent's `value` stays
  // "", and re-deriving from "" wipes out the selection that was just
  // made) — making it impossible to ever pick all three. Local state lets
  // each selection persist while the other two are still being chosen.
  const initial = value ? value.split("-") : ["", "", ""];
  const [y, setY] = useState(initial[0] ?? "");
  const [m, setM] = useState(initial[1] ?? "");
  const [d, setD] = useState(initial[2] ?? "");

  // Stay in sync if the parent sets/clears `value` from outside (e.g.
  // resetting the form) — but never clobber an in-progress local selection
  // just because the combined date isn't complete yet.
  useEffect(() => {
    if (!value) return;
    const [vy, vm, vd] = value.split("-");
    // Un-pad month/day back to plain numbers ("06" -> "6") — the <option>
    // values below are plain numbers (from `i + 1` / `day`), so a
    // zero-padded string here would match no option and show blank.
    setY(vy);
    setM(String(Number(vm)));
    setD(String(Number(vd)));
  }, [value]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i); // this year back 100 years

  function update(part: "y" | "m" | "d", next: string) {
    const parts = { y, m, d, [part]: next };
    if (part === "y") setY(next);
    if (part === "m") setM(next);
    if (part === "d") setD(next);

    if (parts.y && parts.m && parts.d) {
      onChange(`${parts.y}-${parts.m.padStart(2, "0")}-${parts.d.padStart(2, "0")}`);
    } else {
      onChange(""); // incomplete selection — don't emit a partial/invalid date
    }
  }

  const daysInMonth = m && y ? new Date(Number(y), Number(m), 0).getDate() : 31;

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        value={d}
        onChange={(e) => update("d", e.target.value)}
        className="focus-ring border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
      >
        <option value="">Day</option>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>
      <select
        value={m}
        onChange={(e) => update("m", e.target.value)}
        className="focus-ring border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
      >
        <option value="">Month</option>
        {MONTHS.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={y}
        onChange={(e) => update("y", e.target.value)}
        className="focus-ring border border-slate-200/80 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
      >
        <option value="">Year</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}
