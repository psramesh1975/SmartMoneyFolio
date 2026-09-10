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
