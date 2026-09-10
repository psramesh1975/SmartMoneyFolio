"use client";

import { COUNTRIES, countryTimeZones, allTimeZones } from "@/lib/countries";

// Purely controlled — no auto-detection inside. Signup does a one-time
// browser-timezone guess on mount (via the props' initial values); Settings
// just shows whatever the household already has saved. Selecting a
// single-timezone country auto-fills (and effectively locks) that one zone;
// a multi-timezone country narrows the Timezone list instead of showing all
// ~400 IANA names.
export default function CountryTimeZoneFields({
  country,
  timeZone,
  onCountryChange,
  onTimeZoneChange,
}: {
  country: string;
  timeZone: string;
  onCountryChange: (country: string) => void;
  onTimeZoneChange: (timeZone: string) => void;
}) {
  const zonesForCountry = country ? countryTimeZones(country) : [];
  const zones = zonesForCountry.length > 0 ? zonesForCountry : allTimeZones();
  const locked = zonesForCountry.length === 1;

  function handleCountryChange(next: string) {
    onCountryChange(next);
    const zs = countryTimeZones(next);
    if (zs.length === 1) {
      onTimeZoneChange(zs[0]);
    } else if (zs.length > 0 && !zs.includes(timeZone)) {
      onTimeZoneChange(zs[0]);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-base font-medium text-slate-500 dark:text-slate-400">Country</label>
        <select
          required
          value={country}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-slate-900 dark:border-slate-800 dark:bg-canvas-card dark:text-white"
        >
          <option value="" disabled>
            Select country
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-base font-medium text-slate-500 dark:text-slate-400">Timezone</label>
        <select
          required
          value={timeZone}
          disabled={locked}
          onChange={(e) => onTimeZoneChange(e.target.value)}
          className="focus-ring mt-1 w-full border border-slate-200/80 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-800 dark:bg-canvas-card dark:text-white dark:disabled:bg-white/5 dark:disabled:text-slate-400"
        >
          <option value="" disabled>
            Select timezone
          </option>
          {zones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
