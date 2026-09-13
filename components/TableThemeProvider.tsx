import type { TableTheme } from "@/lib/table-themes";

// Sets the household's chosen table theme as CSS custom properties on a
// wrapping <div> — the one place both Monthly Base's and the Monthly
// Tracker's tables read theme colors from, so switching themes restyles
// both consistently instead of each table hardcoding its own palette.
export default function TableThemeProvider({
  theme,
  children,
}: {
  theme: TableTheme;
  children: React.ReactNode;
}) {
  return (
    <div
      style={
        {
          "--table-primary": theme.primary,
          "--table-header-bg": theme.headerBg,
          "--table-header-text": theme.headerText,
          "--table-border": theme.border,
          "--table-divider-bg": theme.dividerBg,
          "--table-divider-text": theme.dividerText,
          "--table-footer-bg": theme.footerBg,
          "--table-footer-text": theme.footerText,
          "--table-hover-bg": theme.hoverBg,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
