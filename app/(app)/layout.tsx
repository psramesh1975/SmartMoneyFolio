import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ClientSidebar from "@/components/ClientSidebar";
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
    <div className="flex min-h-screen bg-paper">
      <ClientSidebar
        isPlatformOwner={session.isPlatformOwner}
        householdName={household?.name ?? ""}
        previousLabel={periodLabel(getPreviousPeriod(timeZone))}
        currentLabel={periodLabel(getCurrentPeriod(timeZone))}
        nextLabel={periodLabel(getNextPeriod(timeZone))}
      />
      <main className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
