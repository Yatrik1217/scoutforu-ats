import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { emailConfigured } from "@/lib/email";
import { ImportDataClient } from "@/components/import-data-client";

export default async function ImportPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");

  return (
    <div className="animate-sc-fadein mx-auto max-w-[860px] p-[22px_26px_40px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Import Data</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>
      <p className="mb-5 text-[13px] text-[#8a94a6]">
        Bulk-import from Excel (.xlsx) or CSV. Download the template, fill it, upload — every row is
        validated, duplicates are skipped, and you get a per-row report. For importing{" "}
        <b>résumé files</b> (PDF/Word) use{" "}
        <Link href="/bulk" className="font-bold text-[#2a6fdb] hover:underline">
          Bulk Upload
        </Link>{" "}
        — it parses each file with AI.
      </p>
      <ImportDataClient smtpConfigured={emailConfigured()} />
    </div>
  );
}
