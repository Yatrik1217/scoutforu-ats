import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { FinanceSidebar } from "@/components/finance-sidebar";
import { FinanceTopbar } from "@/components/finance-topbar";

// Finance is a separate, owner-only product surface that lives beside the ATS
// but has its own shell. Only the Master Admin (the owner) may enter — personal
// expenses live here, so recruiters/clients never see it.
export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  if (profile.role !== "master_admin") redirect("/overview");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#eef1f6]">
      <FinanceSidebar name={profile.name} />
      <main className="flex min-w-0 flex-1 flex-col">
        <FinanceTopbar />
        <div className="relative flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
