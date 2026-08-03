import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { STAGES } from "@/lib/domain";
import { AutomationsManager } from "@/components/automations-manager";

export default async function AutomationsPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");

  const sb = await createClient();
  const [{ data: templates }, { data: rules }] = await Promise.all([
    sb.from("email_templates").select("id,name").order("name"),
    sb.from("stage_email_rules").select("stage,template_id,enabled"),
  ]);

  return (
    <AutomationsManager
      stages={STAGES.map((s) => ({ key: s.key, slug: s.slug, color: s.color }))}
      templates={templates ?? []}
      rules={rules ?? []}
    />
  );
}
