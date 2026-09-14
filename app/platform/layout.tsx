import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PlatformSidebar from "@/components/PlatformSidebar";
import { SectionThemeInit } from "@/components/SectionThemeInit";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformOwner) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Platform console is a fixed dark ops theme (no light/dark toggle,
          unlike the client-facing app) — SectionThemeInit still forces the
          html "dark" class so shared components that key off it (inputs,
          icons, etc.) render correctly here regardless of what the client
          app section was last set to. */}
      <SectionThemeInit defaultTheme="dark" />
      <PlatformSidebar adminEmail={session.email} />
      <main className="max-w-7xl flex-1 space-y-6 overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
