"use client";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

export default function DeltaVsPreviousMonth({
  delta,
  currency,
}: {
  delta: {
    totalSpendChange: number;
    totalSpendChangePercent: number;
    topMovers: { categoryId: string; name: string; change: number }[];
  };
  currency: string;
}) {
  const increased = delta.totalSpendChange > 0;
  const tone = increased ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-cyan-400";
  const arrow = delta.totalSpendChange === 0 ? "" : increased ? "▲" : "▼";

  return (
    <div>
      <p className={`text-sm font-semibold ${tone}`}>
        {arrow} {currency} {fmt(Math.abs(delta.totalSpendChange))} (
        {delta.totalSpendChangePercent >= 0 ? "+" : ""}
        {Math.round(delta.totalSpendChangePercent * 100)}%) vs previous month
      </p>
      {delta.topMovers.length > 0 && (
        <ul className="mt-2 space-y-1">
          {delta.topMovers.map((m) => {
            const up = m.change > 0;
            const moverTone = up ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-cyan-400";
            return (
              <li key={m.categoryId} className={`text-xs ${moverTone}`}>
                {m.change === 0 ? "" : up ? "▲" : "▼"} {m.name}: {currency} {fmt(Math.abs(m.change))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
