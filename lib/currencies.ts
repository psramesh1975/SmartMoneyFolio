// A practical set of world currencies for household/member selection.
// Stored as plain strings in the database (not a fixed enum) so new
// currencies can be added here without a schema migration.
export const CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "INR", name: "Indian Rupee" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "KRW", name: "South Korean Won" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "ZAR", name: "South African Rand" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "THB", name: "Thai Baht" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "OTHER", name: "Other" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];

// Country -> native currency, for signup's browser-timezone-detection
// override: when detection finds a country different from the India/INR
// default, Base Currency needs to follow along with it, not stay stuck on
// INR (e.g. detecting the UAE should default to AED, not leave INR selected
// for a UAE-based household). Every Eurozone country in lib/countries.ts
// maps to EUR; countries whose native currency isn't in CURRENCIES above
// (e.g. Nepal's NPR, Turkey's TRY) fall back to USD, the most neutral
// choice among what's actually selectable in the Base Currency dropdown —
// still just a pre-fill, freely changed before submitting.
const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  IN: "INR",
  PK: "PKR",
  BD: "BDT",
  LK: "LKR",
  SG: "SGD",
  MY: "MYR",
  HK: "HKD",
  CN: "CNY",
  JP: "JPY",
  KR: "KRW",
  PH: "PHP",
  ID: "IDR",
  TH: "THB",
  VN: "VND",
  EG: "EGP",
  NG: "NGN",
  KE: "KES",
  ZA: "ZAR",
  GB: "GBP",
  IE: "EUR",
  FR: "EUR",
  DE: "EUR",
  ES: "EUR",
  PT: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  CH: "CHF",
  AT: "EUR",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  FI: "EUR",
  GR: "EUR",
  US: "USD",
  CA: "CAD",
  MX: "MXN",
  BR: "BRL",
  AU: "AUD",
  NZ: "NZD",
};

export function defaultCurrencyForCountry(countryCode: string): CurrencyCode {
  return COUNTRY_CURRENCY[countryCode] ?? "USD";
}
