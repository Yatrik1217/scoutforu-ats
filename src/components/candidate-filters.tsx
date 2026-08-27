"use client";

import { useRouter } from "next/navigation";

type Params = Record<string, string | undefined>;

// Filter dropdowns on the Candidates tab — pick a source (Naukri / Career Site
// / …) or a recruiter and the list narrows. Navigates with the filter as a URL
// param so it composes with the existing chips + search.
export function CandidateFilters({
  params,
  sources,
  recruiters,
  isAdmin,
}: {
  params: Params;
  sources: string[];
  recruiters: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const nav = (key: string, value: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== key) p.set(k, v);
    if (value) p.set(key, value);
    const qs = p.toString();
    router.push(`/candidates${qs ? `?${qs}` : ""}`);
  };
  const sel =
    "cursor-pointer rounded-[9px] border border-[#e3e8f0] bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-[#42506b] outline-none focus:border-[#2a6fdb]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={sel}
        value={params.source || ""}
        onChange={(e) => nav("source", e.target.value)}
        title="Filter by where the candidate came from"
      >
        <option value="">All sources</option>
        {sources.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {isAdmin && (
        <select
          className={sel}
          value={params.recruiter || ""}
          onChange={(e) => nav("recruiter", e.target.value)}
          title="Filter by recruiter"
        >
          <option value="">All recruiters</option>
          {recruiters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
