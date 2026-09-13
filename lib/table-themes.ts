// 8 preset color themes for the Monthly Base / Monthly Tracker tables —
// household-level, DB-persisted (Household.tableTheme), not localStorage, so
// the choice is the same on every device/browser the household signs into.
// Values taken directly from the reference mockup. A theme only changes
// these tables' header/border/divider/footer/hover colors and primary
// accent — it does not touch the rest of the app's color scheme.

export type TableTheme = {
  key: string;
  label: string;
  primary: string;
  headerBg: string;
  headerText: string;
  border: string;
  dividerBg: string;
  dividerText: string;
  footerBg: string;
  footerText: string;
  hoverBg: string;
};

export const TABLE_THEMES: TableTheme[] = [
  {
    key: "orange",
    label: "Light Orange",
    primary: "#ea580c",
    headerBg: "#fff7ed",
    headerText: "#9a3412",
    border: "#fed7aa",
    dividerBg: "#ffedd5",
    dividerText: "#c2410c",
    footerBg: "#ea580c",
    footerText: "#ffffff",
    hoverBg: "#ffedd5",
  },
  {
    key: "black",
    label: "Jet Black",
    primary: "#0f172a",
    headerBg: "#0f172a",
    headerText: "#ffffff",
    border: "#0f172a",
    dividerBg: "#f1f5f9",
    dividerText: "#334155",
    footerBg: "#0f172a",
    footerText: "#ffffff",
    hoverBg: "#f1f5f9",
  },
  {
    key: "emerald",
    label: "Emerald Mint",
    primary: "#059669",
    headerBg: "#ecfdf5",
    headerText: "#065f46",
    border: "#a7f3d0",
    dividerBg: "#d1fae5",
    dividerText: "#047857",
    footerBg: "#059669",
    footerText: "#ffffff",
    hoverBg: "#d1fae5",
  },
  {
    key: "sky",
    label: "Sky Ocean Blue",
    primary: "#0284c7",
    headerBg: "#f0f9ff",
    headerText: "#075985",
    border: "#bae6fd",
    dividerBg: "#e0f2fe",
    dividerText: "#0369a1",
    footerBg: "#0284c7",
    footerText: "#ffffff",
    hoverBg: "#e0f2fe",
  },
  {
    key: "indigo",
    label: "Indigo Classic",
    primary: "#4f46e5",
    headerBg: "#eef2ff",
    headerText: "#3730a3",
    border: "#c7d2fe",
    dividerBg: "#e0e7ff",
    dividerText: "#4338ca",
    footerBg: "#4f46e5",
    footerText: "#ffffff",
    hoverBg: "#e0e7ff",
  },
  {
    key: "violet",
    label: "Royal Violet",
    primary: "#7c3aed",
    headerBg: "#f5f3ff",
    headerText: "#5b21b6",
    border: "#ddd6fe",
    dividerBg: "#ede9fe",
    dividerText: "#6d28d9",
    footerBg: "#7c3aed",
    footerText: "#ffffff",
    hoverBg: "#ede9fe",
  },
  {
    key: "rose",
    label: "Berry Rose",
    primary: "#e11d48",
    headerBg: "#fff1f2",
    headerText: "#9f1239",
    border: "#fecdd3",
    dividerBg: "#ffe4e6",
    dividerText: "#be123c",
    footerBg: "#e11d48",
    footerText: "#ffffff",
    hoverBg: "#ffe4e6",
  },
  {
    key: "teal",
    label: "Deep Teal",
    primary: "#0d9488",
    headerBg: "#f0fdfa",
    headerText: "#115e59",
    border: "#99f6e4",
    dividerBg: "#ccfbf1",
    dividerText: "#0f766e",
    footerBg: "#0d9488",
    footerText: "#ffffff",
    hoverBg: "#ccfbf1",
  },
];

export const TABLE_THEME_KEYS = TABLE_THEMES.map((t) => t.key);

// Server components read the household's tableTheme string and resolve it
// through here — never trust a client-supplied theme object directly, so an
// invalid/stale key falls back to Orange instead of rendering undefined
// colors.
export function getTableTheme(key: string): TableTheme {
  return TABLE_THEMES.find((t) => t.key === key) ?? TABLE_THEMES[0];
}
