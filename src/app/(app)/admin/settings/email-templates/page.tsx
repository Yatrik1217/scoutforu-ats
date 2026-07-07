import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { EmailTemplatesEditor } from "@/components/settings-modules";
import type { EmailTemplateRow } from "@/lib/database.types";

export default async function EmailTemplatesPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");
  const sb = await createClient();
  const { data } = await sb.from("email_templates").select("*").order("name");
  const templates = (data ?? []) as EmailTemplateRow[];

  return (
    <div className="animate-sc-fadein mx-auto max-w-[720px] p-[22px_26px_40px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Default Emails</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>
      <p className="mb-5 text-[13px] text-[#8a94a6]">
        Templates used by ATS emails. The <b>Client submission</b> template pre-fills the
        &ldquo;Share with Client&rdquo; email.
      </p>
      <EmailTemplatesEditor templates={templates} />
    </div>
  );
}
