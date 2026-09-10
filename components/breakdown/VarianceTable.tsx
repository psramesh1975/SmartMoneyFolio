"use client";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

export default function VarianceTable({
  variance,
  currency,
}: {
  variance: {
    categoryId: string;
    name: string;
    baseTotal: number;
    plannedTotal: number;
    actualTotal: number;
    varianceAmount: number;
    variancePercent: number;
  }[];
  currency: string;
}) {
  if (variance.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">No entries recorded this period yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400">
            <th className="px-2 py-1 font-medium">Category</th>
            <th className="px-2 py-1 text-right font-medium">Base</th>
            <th className="px-2 py-1 text-right font-medium">Planned</th>
            <th className="px-2 py-1 text-right font-medium">Actual</th>
            <th className="px-2 py-1 text-right font-medium">Variance</th>
          </tr>
        </thead>
        <tbody>
          {variance.map((v) => {
            const tone =
              v.varianceAmount > 0
                ? "text-rose-600 dark:text-rose-400"
                : v.varianceAmount < 0
                  ? "text-emerald-600 dark:text-cyan-400"
                  : "text-slate-500 dark:text-slate-400";
            return (
              <tr key={v.categoryId} className="border-t border-slate-200/80 dark:border-slate-800">
                <td className="px-2 py-1.5 text-slate-900 dark:text-white">{v.name}</td>
                <td className="px-2 py-1.5 text-right text-slate-500 dark:text-slate-400">{fmt(v.baseTotal)}</td>
                <td className="px-2 py-1.5 text-right text-slate-500 dark:text-slate-400">{fmt(v.plannedTotal)}</td>
                <td className="px-2 py-1.5 text-right text-slate-900 dark:text-white">{fmt(v.actualTotal)}</td>
                <td className={`px-2 py-1.5 text-right font-medium ${tone}`}>
                  {v.varianceAmount > 0 ? "+" : ""}
                  {currency} {fmt(v.varianceAmount)} ({v.variancePercent >= 0 ? "+" : ""}
                  {Math.round(v.variancePercent * 100)}%)
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
