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
      <p className="mb-3 text-[13px] text-[#8a94a6]">
        Internal approvers review the work of other recruiters. With at least one approver set:
      </p>
      <ul className="mb-5 list-disc space-y-1 pl-5 text-[13px] text-[#8a94a6]">
        <li>
          <b>Candidate profiles</b> — when a recruiter moves a candidate to <b>Screening</b>, the
          profile becomes <b>Awaiting internal approval</b>. An approver reviews it in the candidate
          drawer (Approve / Send back), and only approved profiles can be{" "}
          <b>shared with the client</b>.
        </li>
        <li>
          <b>Job requisitions</b> — new jobs created by other recruiters start as{" "}
          <b>Pending approval</b> before they appear on the public careers page.
        </li>
      </ul>
      <ApproversManager staff={staff} />
    </div>
  );
}
