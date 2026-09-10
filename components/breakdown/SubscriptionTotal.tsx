"use client";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

export default function SubscriptionTotal({
  subscriptions,
  currency,
}: {
  subscriptions: { total: number; hasPriceHike: boolean };
  currency: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Subscriptions
        </p>
        <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          {currency} {fmt(subscriptions.total)}
        </p>
      </div>
      {subscriptions.hasPriceHike && (
        <span className="rounded-full bg-amber-600/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
          Price increase
        </span>
      )}
    </div>
  );
}
