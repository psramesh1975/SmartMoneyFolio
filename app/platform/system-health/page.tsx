import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { getSession } from "@/lib/auth";
import PlatformComingSoon from "@/components/PlatformComingSoon";

export default async function PlatformSystemHealthPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformOwner) redirect("/dashboard");

  return (
    <PlatformComingSoon
      icon={Activity}
      title="System health"
      description="A fuller ops view (uptime, error rates, job status) will live here. A live DB-latency snapshot is already on the main Dashboard."
    />
  );
}
