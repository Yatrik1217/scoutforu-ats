import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Briefcase, ArrowLeft, IndianRupee } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { ApplyForm } from "@/components/apply-form";

export const dynamic = "force-dynamic";

type Org = { name: string; logo_url: string };
type Job = {
  id: string;
  title: string;
  dept: string;
  location: string;
  type: string;
  exp_min: number;
  exp_max: number;
  min_ctc_lpa: number;
  max_ctc_lpa: number;
  hide_salary: boolean;
  description: string;
  status: string;
};

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  let org: Org | null = null;
  let job: Job | null = null;
  try {
    const sb = createServiceClient();
    const { data: o } = await sb.from("organization").select("name,logo_url").maybeSingle();
    // eslint-disable-next-line prefer-const -- j is reassigned in the fallback below
    let { data: j, error } = await sb
      .from("jobs")
      .select("id,title,dept,location,type,exp_min,exp_max,min_ctc_lpa,max_ctc_lpa,hide_salary,description,status")
      .eq("id", jobId)
      .eq("approval_status", "approved")
      .eq("published", true)
      .maybeSingle();
    if (error) {
      // Migration 0021 not applied yet (no "published" column) — old behaviour.
      ({ data: j } = await sb
        .from("jobs")
        .select("id,title,dept,location,type,exp_min,exp_max,min_ctc_lpa,max_ctc_lpa,hide_salary,description,status")
        .eq("id", jobId)
        .eq("approval_status", "approved")
        .maybeSingle());
    }
    org = (o as Org) ?? null;
    job = (j as Job) ?? null;
  } catch {
    /* falls through to notFound */
  }
  if (!job || (job.status !== "open" && job.status !== "hot")) notFound();

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <header className="border-b border-[#e9edf3] bg-white">
        <div className="mx-auto max-w-[760px] px-6 py-5">
          <Link href="/careers" className="flex items-center gap-1.5 text-[13px] font-bold text-[#2a6fdb]">
            <ArrowLeft size={15} /> {org?.name || "All roles"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-6 py-8">
        <h1 className="text-[26px] font-extrabold text-[#16203a]">{job.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#6b7686]">
          {job.dept && (
            <span className="flex items-center gap-1">
              <Briefcase size={14} /> {job.dept}
            </span>
          )}
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {job.location}
            </span>
          )}
          {(job.exp_min || job.exp_max) > 0 && (
            <span>
              {job.exp_min}–{job.exp_max} yrs experience
            </span>
          )}
          {!job.hide_salary && (job.min_ctc_lpa || job.max_ctc_lpa) > 0 && (
            <span className="flex items-center gap-0.5">
              <IndianRupee size={13} />
              {job.min_ctc_lpa}–{job.max_ctc_lpa} LPA
            </span>
          )}
        </div>

        {job.description && (
          <div className="mt-6 whitespace-pre-wrap rounded-[14px] border border-[#e9edf3] bg-white p-6 text-[14px] leading-relaxed text-[#334155]">
            {job.description}
          </div>
        )}

        <div className="mt-6 rounded-[14px] border border-[#e9edf3] bg-white p-6">
          <h2 className="text-[17px] font-extrabold text-[#16203a]">Apply for this role</h2>
          <p className="mt-1 text-[13px] text-[#8a94a6]">Fill in your details and attach your résumé.</p>
          <ApplyForm jobId={job.id} jobTitle={job.title} />
        </div>
      </main>
      <footer className="mx-auto max-w-[760px] px-6 py-8 text-center text-[12px] text-[#9aa4b6]">
        Powered by ScoutforU ATS
      </footer>
    </div>
  );
}
