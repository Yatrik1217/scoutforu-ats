import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { ApproversManager } from "@/components/settings-modules";

export default async function ApproversPage() {
  const { ws, scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");
  const staff = Array.from(ws.profileById.values())
    .filter((u) => u.role !== "client")
    .sort((a, b) => (a.role === "master_admin" ? -1 : b.role === "master_admin" ? 1 : a.name.localeCompare(b.name)))
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, is_approver: u.is_approver }));

  return (
    <div className="animate-sc-fadein mx-auto max-w-[680px] p-[22px_26px_40px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Approvers</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>
      <p className="mb-5 text-[13px] text-[#8a94a6]">
        When at least one approver is set, new requisitions created by other recruiters start as
        <b> Pending approval</b> — an approver (or Master Admin) approves them from the Jobs page
        before they appear on the public careers page.
      </p>
      <ApproversManager staff={staff} />
    </div>
  );
}
