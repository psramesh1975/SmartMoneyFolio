import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getHouseholdTimeZone } from "@/lib/monthly-data";
import { getMostRecentArchivedYear } from "@/lib/monthly-periods";

export default async function EarlierYearsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const timeZone = await getHouseholdTimeZone(session.householdId);
  const archivedYear = getMostRecentArchivedYear(timeZone);

  const rows = await prisma.monthlyEntry.findMany({
    where: { householdId: session.householdId, year: { lte: archivedYear } },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });
  const years = rows.map((r) => r.year);

  return (
    <section className="max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Earlier Years</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Fully archived, read-only years — each with its own yearly summary.
      </p>

      {years.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">No archived years yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-slate-200/80 rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-canvas-card">
          {years.map((year) => (
            <li key={year}>
              <Link
                href={`/monthly/years/${year}`}
                className="focus-ring block px-4 py-3 text-sm text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-white/5"
              >
                {year}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
