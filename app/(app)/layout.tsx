import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ClientSidebar from "@/components/ClientSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) {
    redirect(session.isPlatformOwner ? "/platform" : "/login");
  }

  const household = await prisma.household.findUnique({
    where: { id: session.householdId },
    select: { name: true },
  });

  return (
    <div className="flex min-h-screen bg-paper">
      <ClientSidebar isPlatformOwner={session.isPlatformOwner} householdName={household?.name ?? ""} />
      <main className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
