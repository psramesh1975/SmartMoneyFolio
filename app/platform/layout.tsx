import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PlatformSidebar from "@/components/PlatformSidebar";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformOwner) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-paper">
      <PlatformSidebar />
      <main className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
