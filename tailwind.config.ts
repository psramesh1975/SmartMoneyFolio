import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#161B33",        // near-black navy — primary text
        "ink-2": "#4B5170",    // muted slate — secondary text
        folio: "#2F5FD1",      // vivid royal blue — primary brand / nav / links
        "folio-light": "#5C82E0",
        growth: "#0FA968",     // vivid emerald — positive figures, growth, success states
        amber: "#F2A93B",      // warm amber — highlights, in-progress states
        coral: "#F2545B",      // vivid coral — alerts, suspended, negative figures
        paper: "#FFFFFF",
        "paper-2": "#F4F6FB",  // faint blue-white — section backgrounds, subtle separation
        line: "#E2E6F0",
        "sheet-header": "#375623",  // dark green header/totals row
        "sheet-row": "#C6E0B4",     // light green body row
        "sheet-border": "#000000", // cell borders
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-source-sans)", "sans-serif"],
      },
      borderRadius: {
        sm: "2px",
        md: "3px",
      },
    },
  },
  plugins: [],
};
export default config;
