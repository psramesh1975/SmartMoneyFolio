"use client";
import { useEffect } from "react";
import { useTheme } from "next-themes";

const EXPLICIT_KEY = "smf-theme-explicit";

export function SectionThemeInit({ defaultTheme }: { defaultTheme: "light" | "dark" }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    const userHasChosen = localStorage.getItem(EXPLICIT_KEY) === "true";
    if (!userHasChosen) setTheme(defaultTheme);
    // Only run once per mount of this section — do not re-run on theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
