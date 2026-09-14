import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { getSession } from "@/lib/auth";
import PlatformComingSoon from "@/components/PlatformComingSoon";

export default async function PlatformSubscriptionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformOwner) redirect("/dashboard");

  return (
    <PlatformComingSoon
      icon={CreditCard}
      title="Subscription management"
      description="Tier management and billing controls will live here once the subscription/billing backlog item is scoped."
    />
  );
}
