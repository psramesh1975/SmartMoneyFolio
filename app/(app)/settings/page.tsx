import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.householdId) redirect(session.isPlatformOwner ? "/platform" : "/login");

  const [household, familyMember] = await Promise.all([
    prisma.household.findUnique({
      where: { id: session.householdId },
      select: { name: true },
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
  ]);

  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Settings</h1>
      <p className="mt-2 text-base text-ink-2">
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
              }
            : null
        }
      />
    </section>
  );
}
