import LogoutButton from "@/components/LogoutButton";

export default function AppHeader({ householdName }: { householdName: string }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200/80 bg-white px-8 py-3 dark:border-slate-800 dark:bg-canvas-card">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{householdName}</span>
      <LogoutButton />
    </header>
  );
}
