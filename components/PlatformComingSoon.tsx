import type { LucideIcon } from "lucide-react";

// Shared placeholder for platform nav destinations that exist in the nav
// (and the approved theme) but aren't scoped/built yet: Subscription,
// System Health, Settings. Swap each one out for a real page as it gets
// specced — this just keeps the nav from 404ing in the meantime.
export default function PlatformComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center justify-center rounded-2xl border border-slate-800 bg-canvas-card px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
        <Icon className="h-6 w-6" strokeWidth={2} />
      </div>
      <h1 className="mt-4 text-xl font-extrabold tracking-tight text-white">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400">{description}</p>
      <span className="mt-5 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Coming soon
      </span>
    </section>
  );
}
