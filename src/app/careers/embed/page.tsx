import { MapPin, Briefcase, ArrowUpRight } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type JobLite = {
  id: string;
  title: string;
  dept: string;
  location: string;
  type: string;
  exp_min: number;
  exp_max: number;
};

// Compact, chrome-less jobs list meant to be iframed into the company website
// (www.scoutforu.com). Each row opens the full posting on the careers page in a
// new tab, so applications still happen on the branded careers site.
export default async function CareersEmbedPage() {
  let jobs: JobLite[] = [];
  try {
    const sb = createServiceClient();
    // eslint-disable-next-line prefer-const -- data is reassigned in the fallback below
    let { data, error } = await sb
      .from("jobs")
      .select("id,title,dept,location,type,exp_min,exp_max")
      .in("status", ["open", "hot"])
      .eq("approval_status", "approved")
      .eq("published", true)
      .order("published_at", { ascending: false });
    if (error) {
      // Migration 0021 not applied yet — old show-everything behaviour.
      ({ data } = await sb
        .from("jobs")
        .select("id,title,dept,location,type,exp_min,exp_max")
        .in("status", ["open", "hot"])
        .eq("approval_status", "approved")
        .order("posted_at", { ascending: false }));
    }
    jobs = (data ?? []) as JobLite[];
  } catch {
    /* renders the empty state */
  }

  return (
    <div className="min-h-screen bg-transparent p-2">
      <div className="space-y-2.5">
        {jobs.map((j) => (
          <a
            key={j.id}
            href={`/careers/${j.id}`}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-4 rounded-[13px] border border-[#e9edf3] bg-white p-4 transition hover:border-[#cbd7ea] hover:shadow-[0_6px_18px_rgba(20,32,58,.08)]"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-extrabold text-[#16203a]">{j.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-[#6b7686]">
                {j.dept && (
                  <span className="flex items-center gap-1">
                    <Briefcase size={12} /> {j.dept}
                  </span>
                )}
                {j.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {j.location}
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
            <ArrowUpRight
              size={16}
              className="shrink-0 text-[#2a6fdb] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        ))}
        {!jobs.length && (
          <div className="rounded-[13px] border border-[#e9edf3] bg-white p-8 text-center text-[13px] text-[#8a94a6]">
            No open positions right now. Please check back soon.
          </div>
        )}
      </div>
    </div>
  );
}
