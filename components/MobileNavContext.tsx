"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Bridges the mobile nav drawer's open/closed state between AppHeader.tsx
// (which renders the hamburger trigger, since that's the existing
// mobile-visible header) and ClientSidebar.tsx (which owns the drawer
// content) — two sibling client components composed by the server-component
// app/(app)/layout.tsx, so a plain lifted useState isn't reachable by both
// without this context sitting above them.
type MobileNavContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value: MobileNavContextValue = {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v),
  };
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used within a MobileNavProvider");
  return ctx;
}
