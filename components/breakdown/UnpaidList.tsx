"use client";

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

export default function UnpaidList({
  unpaid,
  currency,
}: {
  unpaid: {
    categoryId: string;
    categoryName: string;
    entryName: string;
    plannedAmount: number;
    dueStatus: "current" | "overdue";
  }[];
  currency: string;
}) {
  if (unpaid.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Nothing pending — all Actuals recorded.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {unpaid.map((u, i) => (
        <li
          key={`${u.categoryId}-${u.entryName}-${i}`}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="text-slate-900 dark:text-white">
            {u.entryName}
            <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">({u.categoryName})</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">
              {currency} {fmt(u.plannedAmount)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                u.dueStatus === "overdue"
                  ? "bg-rose-600/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400"
                  : "bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400"
              }`}
            >
              {u.dueStatus === "overdue" ? "Overdue" : "Due"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
