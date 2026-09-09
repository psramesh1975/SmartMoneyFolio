// Country -> IANA timezone list, for the signup and Settings country/timezone
// pickers. Not exhaustive of every country on Earth, but covers everywhere a
// household on this app is realistically based (superset of lib/currencies.ts's
// coverage). Countries with more than one zone list the major ones so the
// timezone dropdown can be usefully narrowed instead of showing all ~400 IANA
// names — the household can always pick the exact zone that matches them.
export const COUNTRIES = [
  { code: "AE", name: "United Arab Emirates", timeZones: ["Asia/Dubai"] },
  { code: "SA", name: "Saudi Arabia", timeZones: ["Asia/Riyadh"] },
  { code: "QA", name: "Qatar", timeZones: ["Asia/Qatar"] },
  { code: "KW", name: "Kuwait", timeZones: ["Asia/Kuwait"] },
  { code: "BH", name: "Bahrain", timeZones: ["Asia/Bahrain"] },
  { code: "OM", name: "Oman", timeZones: ["Asia/Muscat"] },
  { code: "IN", name: "India", timeZones: ["Asia/Kolkata"] },
  { code: "PK", name: "Pakistan", timeZones: ["Asia/Karachi"] },
  { code: "BD", name: "Bangladesh", timeZones: ["Asia/Dhaka"] },
  { code: "LK", name: "Sri Lanka", timeZones: ["Asia/Colombo"] },
  { code: "NP", name: "Nepal", timeZones: ["Asia/Kathmandu"] },
  { code: "SG", name: "Singapore", timeZones: ["Asia/Singapore"] },
  { code: "MY", name: "Malaysia", timeZones: ["Asia/Kuala_Lumpur"] },
  { code: "HK", name: "Hong Kong", timeZones: ["Asia/Hong_Kong"] },
  { code: "CN", name: "China", timeZones: ["Asia/Shanghai"] },
  { code: "JP", name: "Japan", timeZones: ["Asia/Tokyo"] },
  { code: "KR", name: "South Korea", timeZones: ["Asia/Seoul"] },
  { code: "PH", name: "Philippines", timeZones: ["Asia/Manila"] },
  { code: "ID", name: "Indonesia", timeZones: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] },
  { code: "TH", name: "Thailand", timeZones: ["Asia/Bangkok"] },
  { code: "VN", name: "Vietnam", timeZones: ["Asia/Ho_Chi_Minh"] },
  { code: "TW", name: "Taiwan", timeZones: ["Asia/Taipei"] },
  { code: "IL", name: "Israel", timeZones: ["Asia/Jerusalem"] },
  { code: "TR", name: "Turkey", timeZones: ["Europe/Istanbul"] },
  { code: "EG", name: "Egypt", timeZones: ["Africa/Cairo"] },
  { code: "NG", name: "Nigeria", timeZones: ["Africa/Lagos"] },
  { code: "KE", name: "Kenya", timeZones: ["Africa/Nairobi"] },
  { code: "ZA", name: "South Africa", timeZones: ["Africa/Johannesburg"] },
  { code: "GB", name: "United Kingdom", timeZones: ["Europe/London"] },
  { code: "IE", name: "Ireland", timeZones: ["Europe/Dublin"] },
  { code: "FR", name: "France", timeZones: ["Europe/Paris"] },
  { code: "DE", name: "Germany", timeZones: ["Europe/Berlin"] },
  { code: "ES", name: "Spain", timeZones: ["Europe/Madrid"] },
  { code: "PT", name: "Portugal", timeZones: ["Europe/Lisbon"] },
  { code: "IT", name: "Italy", timeZones: ["Europe/Rome"] },
  { code: "NL", name: "Netherlands", timeZones: ["Europe/Amsterdam"] },
  { code: "BE", name: "Belgium", timeZones: ["Europe/Brussels"] },
  { code: "CH", name: "Switzerland", timeZones: ["Europe/Zurich"] },
  { code: "AT", name: "Austria", timeZones: ["Europe/Vienna"] },
  { code: "SE", name: "Sweden", timeZones: ["Europe/Stockholm"] },
  { code: "NO", name: "Norway", timeZones: ["Europe/Oslo"] },
  { code: "DK", name: "Denmark", timeZones: ["Europe/Copenhagen"] },
  { code: "FI", name: "Finland", timeZones: ["Europe/Helsinki"] },
  { code: "PL", name: "Poland", timeZones: ["Europe/Warsaw"] },
  { code: "GR", name: "Greece", timeZones: ["Europe/Athens"] },
  { code: "RU", name: "Russia", timeZones: ["Europe/Moscow", "Asia/Yekaterinburg", "Asia/Novosibirsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Vladivostok"] },
  { code: "US", name: "United States", timeZones: ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"] },
  { code: "CA", name: "Canada", timeZones: ["America/St_Johns", "America/Halifax", "America/Toronto", "America/Winnipeg", "America/Edmonton", "America/Vancouver"] },
  { code: "MX", name: "Mexico", timeZones: ["America/Mexico_City", "America/Cancun", "America/Chihuahua", "America/Tijuana"] },
  { code: "BR", name: "Brazil", timeZones: ["America/Sao_Paulo", "America/Manaus", "America/Rio_Branco", "America/Noronha"] },
  { code: "AR", name: "Argentina", timeZones: ["America/Argentina/Buenos_Aires"] },
  { code: "CL", name: "Chile", timeZones: ["America/Santiago"] },
  { code: "CO", name: "Colombia", timeZones: ["America/Bogota"] },
  { code: "PE", name: "Peru", timeZones: ["America/Lima"] },
  { code: "AU", name: "Australia", timeZones: ["Australia/Perth", "Australia/Darwin", "Australia/Adelaide", "Australia/Brisbane", "Australia/Sydney", "Australia/Melbourne", "Australia/Hobart"] },
  { code: "NZ", name: "New Zealand", timeZones: ["Pacific/Auckland"] },
  { code: "AF", name: "Afghanistan", timeZones: ["Asia/Kabul"] },
  { code: "IQ", name: "Iraq", timeZones: ["Asia/Baghdad"] },
  { code: "JO", name: "Jordan", timeZones: ["Asia/Amman"] },
  { code: "LB", name: "Lebanon", timeZones: ["Asia/Beirut"] },
  { code: "UA", name: "Ukraine", timeZones: ["Europe/Kyiv"] },
  { code: "RO", name: "Romania", timeZones: ["Europe/Bucharest"] },
  { code: "CZ", name: "Czech Republic", timeZones: ["Europe/Prague"] },
  { code: "HU", name: "Hungary", timeZones: ["Europe/Budapest"] },
  { code: "OTHER", name: "Other", timeZones: [] }, // falls through to the full IANA list
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [CountryCode, ...CountryCode[]];

export function countryTimeZones(code: string): readonly string[] {
  return COUNTRIES.find((c) => c.code === code)?.timeZones ?? [];
}

// Used once, at signup, to pre-fill Country from the browser-detected
// timezone — the field stays a real, editable dropdown either way, this
// just saves a click when the guess is right.
export function findCountryForTimeZone(tz: string): CountryCode | null {
  const match = COUNTRIES.find((c) => (c.timeZones as readonly string[]).includes(tz));
  return match?.code ?? null;
}

// The full IANA timezone list, used when a country has no fixed zone list
// (COUNTRIES entry with an empty timeZones array, e.g. "Other") or as a
// fallback if the runtime can't enumerate it.
export function allTimeZones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      // fall through
    }
  }
  // Minimal fallback for older runtimes without Intl.supportedValuesOf —
  // every zone referenced by COUNTRIES above, deduped, plus UTC.
  const set = new Set<string>(["UTC"]);
  for (const c of COUNTRIES) for (const tz of c.timeZones) set.add(tz);
  return Array.from(set).sort();
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
