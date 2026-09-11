import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ClientSidebar from "@/components/ClientSidebar";
import AppHeader from "@/components/AppHeader";
import { SectionThemeInit } from "@/components/SectionThemeInit";
import { MobileNavProvider } from "@/components/MobileNavContext";
import { getPreviousPeriod, getCurrentPeriod, getNextPeriod, MONTH_LABELS_SHORT } from "@/lib/monthly-periods";

function periodLabel({ year, month }: { year: number; month: number }) {
  return `${MONTH_LABELS_SHORT[month - 1]} ${year}`;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) {
    redirect(session.isPlatformOwner ? "/platform" : "/login");
  }

  const household = await prisma.household.findUnique({
    where: { id: session.householdId },
    select: { name: true, timeZone: true },
  });
  const timeZone = household?.timeZone || "UTC";

  return (
    <MobileNavProvider>
      <div className="flex min-h-screen bg-slate-50 dark:bg-canvas">
        <SectionThemeInit defaultTheme="light" />
        <ClientSidebar
          isPlatformOwner={session.isPlatformOwner}
          householdName={household?.name ?? ""}
          previousLabel={periodLabel(getPreviousPeriod(timeZone))}
          currentLabel={periodLabel(getCurrentPeriod(timeZone))}
          nextLabel={periodLabel(getNextPeriod(timeZone))}
        />
        {/* min-w-0 overrides the flex item default of min-width: auto (sized
            to content's intrinsic width) — without it, wide unwrappable
            content (e.g. the Liabilities KPI cards) prevents this flex item
            from shrinking below that width, pushing the whole page wider
            than the viewport at narrow widths. This was always latent here;
            it only surfaced once the sidebar stopped taking up its own
            fixed width at <768px and stopped being the first thing a click
            landed on instead. */}
        <main className="flex min-w-0 flex-1 flex-col">
          <AppHeader householdName={household?.name ?? ""} />
          <div className="px-8 py-10">{children}</div>
        </main>
      </div>
    </MobileNavProvider>
  );
}
