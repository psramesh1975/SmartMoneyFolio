import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Custom surfaces that don't exist in stock Tailwind shades
        canvas: "#06080E",        // dark-mode page background
        "canvas-card": "#0E131F", // dark-mode card background
        "sidebar-dark": "#0A0E17",// dark-mode sidebar background

        // Monthly Tracking spreadsheet-style grid. The header stays the same
        // dark green in both themes (it's already dark enough to read fine
        // against a dark canvas); the row/border get a dark-mode pair so the
        // grid doesn't sit as a bright light-sage block on a dark page.
        "sheet-header": "#275216",
        "sheet-row": "#b9e0a5",
        "sheet-border": "#8cb878",
        "sheet-row-dark": "#16260f",
        "sheet-border-dark": "#3a5a2c",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "Inter", "sans-serif"],
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
