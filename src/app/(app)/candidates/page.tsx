import { loadWorkspace } from "@/lib/data";
import { Avatar, StageBadge } from "@/components/bits";
import { ClickableTr, NewCandidateButton } from "@/components/view-actions";
import { ExportCsvButton } from "@/components/export-csv";
import { ShareClientButton } from "@/components/share-client-modal";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { ws, scope } = await loadWorkspace();
  const query = (q ?? "").trim().toLowerCase();
  const rows = ws.candidates.filter(
    (c) =>
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.jobTitle.toLowerCase().includes(query) ||
      c.tags.join(" ").toLowerCase().includes(query),
  );

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <span className="tf-num text-[13px] font-semibold text-[#8a94a6]">
          {rows.length} candidates
        </span>
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
      <div className="overflow-hidden rounded-[14px] border border-[#e9edf3] bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f7f9fc]">
              {["Candidate", "Role", "Stage", "Rating", "Source", "Recruiter", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="p-[13px_18px] text-left text-[11px] font-bold text-[#8a94a6]"
                  >
                    {h.toUpperCase()}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ClickableTr
                key={r.id}
                id={r.id}
                className="cursor-pointer border-t border-[#f0f3f8] hover:bg-[#f9fbfe]"
              >
                  <td className="p-[12px_18px]">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} size={32} />
                      <div>
                        <div className="text-[13px] font-bold">{r.name}</div>
                        <div className="text-[11px] text-[#9aa4b6]">
                          {r.exp_years}y · {r.location}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-[12px_18px] text-[13px] font-semibold text-[#42506b]">
                    {r.jobTitle}
                  </td>
                  <td className="p-[12px_18px]">
                    <StageBadge stage={r.stageKey} />
                  </td>
                  <td className="tf-num p-[12px_18px] text-[13px] font-extrabold text-[#b27400]">
                    ★ {r.rating.toFixed(1)}
                  </td>
                  <td className="p-[12px_18px] text-[12.5px] font-semibold text-[#42506b]">
                    {r.source}
                  </td>
                  <td className="p-[12px_18px] text-[13px] font-semibold text-[#42506b]">
                    {r.recruiterName}
                  </td>
                  <td className="p-[12px_18px] text-right text-[12px] font-bold text-[#2a6fdb]">
                    View →
                  </td>
              </ClickableTr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
