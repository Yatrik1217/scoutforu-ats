import Link from "next/link";
import { X } from "lucide-react";
import { loadWorkspace } from "@/lib/data";
import { stageFromSlug, stageToSlug } from "@/lib/domain";
import { NewCandidateButton } from "@/components/view-actions";
import { ExportCsvButton } from "@/components/export-csv";
import { ShareClientButton } from "@/components/share-client-modal";
import { CandidatesBulk } from "@/components/candidates-bulk";

type Params = {
  q?: string;
  stage?: string;
  source?: string;
  recruiter?: string;
  job?: string;
  review?: string;
};

// Build /candidates href with one filter removed (for chip × buttons).
function hrefWithout(params: Params, drop: keyof Params) {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k !== drop && v) qp.set(k, v);
  }
  const s = qp.toString();
  return s ? `/candidates?${s}` : "/candidates";
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const { q, stage, source, recruiter, job, review } = params;
  const { ws, scope } = await loadWorkspace();
  const query = (q ?? "").trim().toLowerCase();

  const rows = ws.candidates.filter((c) => {
    if (
      query &&
      !c.name.toLowerCase().includes(query) &&
      !c.jobTitle.toLowerCase().includes(query) &&
      !c.tags.join(" ").toLowerCase().includes(query)
    )
      return false;
    if (stage && stageToSlug(c.stageKey) !== stage) return false;
    if (source && (c.source ?? "").toLowerCase() !== source.toLowerCase()) return false;
    if (recruiter && c.recruiter_id !== recruiter) return false;
    if (job && c.job_id !== job) return false;
    if (review && c.review_status !== review) return false;
    return true;
  });

  // Active-filter chips (label + href that removes just that filter).
  const chips: { key: keyof Params; label: string }[] = [];
  if (stage) chips.push({ key: "stage", label: `Stage: ${stageFromSlug(stage)}` });
  if (source) chips.push({ key: "source", label: `Source: ${source}` });
  if (recruiter)
    chips.push({
      key: "recruiter",
      label: `Recruiter: ${ws.profileById.get(recruiter)?.name ?? "Unknown"}`,
    });
  if (job)
    chips.push({
      key: "job",
      label: `Job: ${ws.jobs.find((j) => j.id === job)?.title ?? "Unknown"}`,
    });
  if (review)
    chips.push({
      key: "review",
      label:
        review === "pending"
          ? "Awaiting approval"
          : review === "approved"
            ? "Approved profiles"
            : `Review: ${review}`,
    });

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tf-num text-[13px] font-semibold text-[#8a94a6]">
            {rows.length} candidates
          </span>
          {chips.map((c) => (
            <Link
              key={c.key}
              href={hrefWithout(params, c.key)}
              className="flex items-center gap-1.5 rounded-full bg-[#eef4fe] px-3 py-1 text-[11.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
              title="Remove filter"
            >
              {c.label}
              <X size={12} strokeWidth={3} />
            </Link>
          ))}
          {chips.length > 0 && (
            <Link
              href="/candidates"
              className="text-[11.5px] font-bold text-[#8a94a6] hover:text-[#42506b]"
            >
              Clear all
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scope.role !== "client" && (
            <ShareClientButton
              candidates={rows.map((c) => ({
                id: c.id,
                name: c.name,
                jobTitle: c.jobTitle,
                stageKey: c.stageKey,
                exp_years: c.exp_years,
                location: c.location ?? null,
              }))}
              clients={ws.clients
                .filter((cl) => cl.contact_email)
                .map((cl) => ({ name: cl.name, email: cl.contact_email as string }))}
            />
          )}
          <ExportCsvButton
            filename="candidates"
            rows={rows.map((c) => ({
              Name: c.name,
              Email: c.email ?? "",
              Phone: c.phone ?? "",
              Role: c.jobTitle,
              Stage: c.stageKey,
              Location: c.location ?? "",
              "Experience (yrs)": c.exp_years,
              "Current CTC (LPA)": c.current_ctc_lpa,
              "Expected CTC (LPA)": c.expected_ctc_lpa,
              "Notice (days)": c.notice_period_days,
              Designation: c.current_designation,
              Company: c.current_company,
              Source: c.source ?? "",
              Recruiter: c.recruiterName,
              Rating: c.rating,
              Skills: c.tags.join("; "),
            }))}
          />
          <NewCandidateButton />
        </div>
      </div>
      <CandidatesBulk
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          exp_years: r.exp_years,
          location: r.location ?? null,
          jobTitle: r.jobTitle,
          stageKey: r.stageKey,
          rating: r.rating,
          source: r.source ?? null,
          recruiterName: r.recruiterName,
        }))}
        recruiters={ws.team
          .filter((p) => p.role === "recruiter")
          .map((p) => ({ id: p.id, name: p.name }))}
        isAdmin={scope.role === "master_admin"}
      />
    </div>
  );
}
