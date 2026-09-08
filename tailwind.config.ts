import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12203A",       // deep bridge-steel navy — primary
        "ink-2": "#1B2E4F",   // lighter navy for panels
        span: "#B8823A",      // brass/span accent — the bridge's structure
        "span-light": "#D9A85C",
        paper: "#F5F2EC",     // warm paper background
        "paper-2": "#EDE8DD",
        rupee: "#3C6E52",     // muted teal-green for INR figures
        dirham: "#8A4B2E",    // warm rust for AED figures
        line: "#D8D0BF",
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
