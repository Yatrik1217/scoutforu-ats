import { requireProfile } from "@/lib/auth";
import { getEffectiveScope } from "@/lib/preview";
import { getNavCounts } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { ShellProvider } from "@/components/shell-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const sb = await createClient();
  const [{ data: clients }, { data: team }, counts] = await Promise.all([
    sb.from("clients").select("*").order("name"),
    sb
      .from("profiles")
      .select("*")
      .neq("role", "client")
      .eq("active", true),
    getNavCounts(),
  ]);
  const scope = await getEffectiveScope(profile, clients ?? []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#eef1f6]">
      <AppSidebar
        name={profile.name}
        role={scope.role}
        jobsCount={counts.jobs}
        interviewsCount={counts.interviews}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <ShellProvider role={scope.role} team={team ?? []} clients={clients ?? []}>
          <AppTopbar
            effectiveRole={scope.role}
            realRole={scope.realRole}
            scopeLabel={scope.scopeLabel}
            clients={clients ?? []}
          />
          <div className="relative flex-1 overflow-auto">{children}</div>
        </ShellProvider>
      </main>
    </div>
  );
}
