import Link from "next/link";
import { MapPin, Briefcase, ArrowRight } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OrgLite = { name: string; tagline: string; logo_url: string };
type JobLite = {
  id: string;
  title: string;
  dept: string;
  location: string;
  type: string;
  exp_min: number;
  exp_max: number;
};

async function loadCareers(): Promise<{ org: OrgLite | null; jobs: JobLite[] }> {
  let sb;
  try {
    sb = createServiceClient();
  } catch {
    return { org: null, jobs: [] };
  }
  // Fetch independently so a missing organization row/table never hides the jobs.
  const { data: orgData } = await sb.from("organization").select("name,tagline,logo_url").maybeSingle();
  const { data: jobsData } = await sb
    .from("jobs")
    .select("id,title,dept,location,type,exp_min,exp_max")
    .in("status", ["open", "hot"])
    .eq("approval_status", "approved")
    .order("posted_at", { ascending: false });
  return { org: (orgData as OrgLite) ?? null, jobs: (jobsData ?? []) as JobLite[] };
}

export default async function CareersPage() {
  const { org, jobs } = await loadCareers();
  const name = org?.name || "Careers";

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <header className="border-b border-[#e9edf3] bg-white">
        <div className="mx-auto flex max-w-[880px] items-center gap-3 px-6 py-6">
          {org?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={name} className="h-10 w-auto" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#2a6fdb] text-[16px] font-extrabold text-white">
              {name.charAt(0)}
            </div>
          )}
          <div>
            <div className="text-[18px] font-extrabold text-[#16203a]">{name}</div>
            {org?.tagline && <div className="text-[12.5px] text-[#8a94a6]">{org.tagline}</div>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[880px] px-6 py-8">
        <h1 className="text-[24px] font-extrabold text-[#16203a]">Open Positions</h1>
        <p className="mt-1 text-[13.5px] text-[#8a94a6]">
          {jobs.length} role{jobs.length === 1 ? "" : "s"} currently hiring.
        </p>

        <div className="mt-6 space-y-3">
          {jobs.map((j) => (
            <Link
              key={j.id}
              href={`/careers/${j.id}`}
              className="group flex items-center gap-4 rounded-[14px] border border-[#e9edf3] bg-white p-5 transition hover:border-[#cbd7ea] hover:shadow-[0_8px_24px_rgba(20,32,58,.08)]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-extrabold text-[#16203a]">{j.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[#6b7686]">
                  {j.dept && (
                    <span className="flex items-center gap-1">
                      <Briefcase size={13} /> {j.dept}
                    </span>
                  )}
                  {j.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={13} /> {j.location}
                    </span>
                  )}
                  {(j.exp_min || j.exp_max) > 0 && (
                    <span>
                      {j.exp_min}–{j.exp_max} yrs
                    </span>
                  )}
                  {j.type && <span className="capitalize">{j.type.replace(/_/g, " ")}</span>}
                </div>
              </div>
              <ArrowRight size={18} className="shrink-0 text-[#2a6fdb] transition group-hover:translate-x-0.5" />
            </Link>
          ))}
          {!jobs.length && (
            <div className="rounded-[14px] border border-[#e9edf3] bg-white p-10 text-center text-[13.5px] text-[#8a94a6]">
              No open positions right now. Please check back soon.
            </div>
          )}
        </div>
      </main>

      <footer className="mx-auto max-w-[880px] px-6 py-8 text-center text-[12px] text-[#9aa4b6]">
        Powered by ScoutforU ATS
      </footer>
    </div>
  );
}
