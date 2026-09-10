import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PlatformSidebar from "@/components/PlatformSidebar";
import { SectionThemeInit } from "@/components/SectionThemeInit";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformOwner) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-canvas">
      <SectionThemeInit defaultTheme="dark" />
      <PlatformSidebar />
      <main className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
