import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart Money Folio — Your Money. Your Wealth. Your Future.",
  description:
    "One ledger for money that lives in two countries. Track cash flow, investments, and net worth across currencies and family members.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-slate-50 text-slate-900 dark:bg-canvas dark:text-white">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="smf-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
