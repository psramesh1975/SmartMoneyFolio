import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const [household, familyMember, usersWithAccess] = await Promise.all([
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { name: true, country: true, timeZone: true },
    }),
    prisma.familyMember.findUnique({
      where: { linkedUserId: session.userId },
      select: {
        name: true,
        city: true,
        address: true,
        operationalCurrency: true,
        residencyStatus: true,
      },
    }),
    prisma.user.findMany({
      where: { householdId: session.householdId },
      select: { id: true, email: true },
    }),
  ]);

  return (
    <section className="max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Settings</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {household?.name ?? "Your household"} · {session.email}
      </p>

      <SettingsClient
        initialProfile={
          familyMember
            ? {
                name: familyMember.name,
                city: familyMember.city ?? "",
                address: familyMember.address ?? "",
                operationalCurrency: familyMember.operationalCurrency,
                residencyStatus: familyMember.residencyStatus,
                country: household?.country ?? "",
                timeZone: household?.timeZone ?? "",
              }
            : null
        }
      />

      <div className="mt-8">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">People with access</h2>
        <div className="mt-4 divide-y divide-slate-200/80 rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow dark:divide-slate-800 dark:border-slate-800 dark:bg-canvas-card dark:hover:border-cyan-500/40">
          {usersWithAccess.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-slate-900 dark:text-white">{u.email}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
