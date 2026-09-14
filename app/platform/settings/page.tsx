import { redirect } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import PlatformComingSoon from "@/components/PlatformComingSoon";

export default async function PlatformSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformOwner) redirect("/dashboard");

  return (
    <PlatformComingSoon
      icon={SettingsIcon}
      title="Platform settings"
      description="Platform-wide configuration will live here once scoped."
    />
  );
}
