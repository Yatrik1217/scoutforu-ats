import { createServiceClient } from "@/lib/supabase/server";
import { CareersBrowser, type CareerJob } from "@/components/careers-browser";
import { maskClientName } from "@/lib/careers";

export const dynamic = "force-dynamic";

type OrgLite = { name: string; tagline: string; logo_url: string };
type JobRaw = CareerJob & { client_id: string | null };

const COLS = "id,title,dept,location,type,exp_min,exp_max,openings,description,posted_at,client_id";

async function loadCareers(): Promise<{ org: OrgLite | null; jobs: CareerJob[] }> {
  let sb;
  try {
    sb = createServiceClient();
  } catch {
    return { org: null, jobs: [] };
  }
  // Fetch independently so a missing organization row/table never hides the jobs.
  const { data: orgData } = await sb.from("organization").select("name,tagline,logo_url").maybeSingle();
  // eslint-disable-next-line prefer-const -- jobsData is reassigned in the fallback below
  let { data: jobsData, error } = await sb
    .from("jobs")
    .select(COLS)
    .in("status", ["open", "hot"])
    .eq("approval_status", "approved")
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (error) {
    // Migration 0021 not applied yet (no "published" column) — fall back to the
    // old behaviour of listing every approved open role.
    ({ data: jobsData } = await sb
      .from("jobs")
      .select(COLS)
      .in("status", ["open", "hot"])
      .eq("approval_status", "approved")
      .order("posted_at", { ascending: false }));
  }
  const raw = (jobsData ?? []) as JobRaw[];

  // Strip the client's name out of every public JD (agency confidentiality).
  const { data: clientRows } = await sb.from("clients").select("id,name");
  const clientName = new Map((clientRows ?? []).map((c) => [c.id, c.name as string]));
  const jobs: CareerJob[] = raw.map(({ client_id, ...j }) => ({
    ...j,
    description: maskClientName(j.description, client_id ? clientName.get(client_id) : ""),
  }));

  return { org: (orgData as OrgLite) ?? null, jobs };
}

export default async function CareersPage() {
  const { org, jobs } = await loadCareers();
  return (
    <div id="top">
      <CareersBrowser org={org} jobs={jobs} />
    </div>
  );
}
