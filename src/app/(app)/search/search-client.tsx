"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  INDIAN_CITIES,
  FUNCTIONAL_AREAS,
  INDUSTRIES,
  QUALIFICATIONS,
  GENDERS,
  fmtSalary,
} from "@/lib/domain";
import { Avatar, StageBadge } from "@/components/bits";
import { useShell } from "@/components/shell-provider";
import type { EnrichedCandidate } from "@/lib/data";

const fieldCls =
  "w-full rounded-[10px] border border-[#e3e8f0] px-3 py-2.5 text-[13.5px] font-semibold text-[#16203a] outline-none focus:border-[#2a6fdb] bg-white";
const labelCls = "mb-1.5 block text-xs font-bold text-[#42506b]";

const splitWords = (s: string) =>
  s
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);

function haystack(c: EnrichedCandidate) {
  return [
    c.name,
    c.jobTitle,
    c.current_designation,
    c.current_company,
    c.location,
    c.function,
    c.industry,
    c.graduation,
    c.post_graduation,
    ...c.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function SearchClient({ candidates }: { candidates: EnrichedCandidate[] }) {
  const [tab, setTab] = useState<"resumes" | "people">("resumes");
  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-4 flex gap-1 rounded-[10px] bg-[#eef1f6] p-[3px]">
        {(
          [
            ["resumes", "Search Resumes"],
            ["people", "People Search"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="rounded-lg px-4 py-2 text-[13px] font-bold transition"
            style={
              tab === id
                ? { background: "#fff", color: "#2a6fdb", boxShadow: "0 1px 3px rgba(20,40,80,.12)" }
                : { color: "#7a8696" }
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "resumes" ? (
        <ResumeSearch candidates={candidates} />
      ) : (
        <PeopleSearch candidates={candidates} />
      )}
    </div>
  );
}

function ResumeSearch({ candidates }: { candidates: EnrichedCandidate[] }) {
  const [anyKw, setAnyKw] = useState("");
  const [allKw, setAllKw] = useState("");
  const [city, setCity] = useState("");
  const [qual, setQual] = useState("");
  const [expMin, setExpMin] = useState("");
  const [expMax, setExpMax] = useState("");
  const [ctcMin, setCtcMin] = useState("");
  const [ctcMax, setCtcMax] = useState("");
  const [func, setFunc] = useState("");
  const [industry, setIndustry] = useState("");
  const [gender, setGender] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const results = useMemo(() => {
    if (!submitted) return [];
    const anyW = splitWords(anyKw);
    const allW = splitWords(allKw);
    const eMin = parseFloat(expMin),
      eMax = parseFloat(expMax),
      cMin = parseFloat(ctcMin),
      cMax = parseFloat(ctcMax);
    return candidates.filter((c) => {
      const hay = haystack(c);
      if (anyW.length && !anyW.some((w) => hay.includes(w))) return false;
      if (allW.length && !allW.every((w) => hay.includes(w))) return false;
      if (city && !(c.location ?? "").toLowerCase().includes(city.toLowerCase()))
        return false;
      if (qual && c.graduation !== qual && c.post_graduation !== qual) return false;
      if (!isNaN(eMin) && c.exp_years < eMin) return false;
      if (!isNaN(eMax) && c.exp_years > eMax) return false;
      if (!isNaN(cMin) && c.expected_ctc_lpa < cMin) return false;
      if (!isNaN(cMax) && c.expected_ctc_lpa > cMax) return false;
      if (func && c.function !== func) return false;
      if (industry && c.industry !== industry) return false;
      if (gender && c.gender !== gender) return false;
      return true;
    });
  }, [submitted, anyKw, allKw, city, qual, expMin, expMax, ctcMin, ctcMax, func, industry, gender, candidates]);

  return (
    <>
      <datalist id="search-cities">
        {INDIAN_CITIES.map((c) => <option key={c} value={c} />)}
      </datalist>
      <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
        <div className="grid grid-cols-2 gap-3.5">
          <div className="col-span-2">
            <label className={labelCls}>Any Keywords (comma-separated — match any)</label>
            <input value={anyKw} onChange={(e) => setAnyKw(e.target.value)} className={fieldCls} placeholder="React, Node, Bangalore" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>All Keywords (comma-separated — match all)</label>
            <input value={allKw} onChange={(e) => setAllKw(e.target.value)} className={fieldCls} placeholder="Java, Spring" />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input list="search-cities" value={city} onChange={(e) => setCity(e.target.value)} className={fieldCls} placeholder="Any city" />
          </div>
          <div>
            <label className={labelCls}>Qualification</label>
            <select value={qual} onChange={(e) => setQual(e.target.value)} className={`${fieldCls} cursor-pointer`}>
              <option value="">Any</option>
              {QUALIFICATIONS.map((q) => <option key={q}>{q}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Exp From (yrs)</label><input inputMode="decimal" value={expMin} onChange={(e) => setExpMin(e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} /></div>
            <div><label className={labelCls}>Exp To (yrs)</label><input inputMode="decimal" value={expMax} onChange={(e) => setExpMax(e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>CTC From (LPA)</label><input inputMode="decimal" value={ctcMin} onChange={(e) => setCtcMin(e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} /></div>
            <div><label className={labelCls}>CTC To (LPA)</label><input inputMode="decimal" value={ctcMax} onChange={(e) => setCtcMax(e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} /></div>
          </div>
          <div>
            <label className={labelCls}>Function</label>
            <select value={func} onChange={(e) => setFunc(e.target.value)} className={`${fieldCls} cursor-pointer`}>
              <option value="">Any</option>
              {FUNCTIONAL_AREAS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Industry</label>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={`${fieldCls} cursor-pointer`}>
              <option value="">Any</option>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={`${fieldCls} cursor-pointer`}>
              <option value="">Any</option>
              {GENDERS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={() => setSubmitted(true)}
          className="mt-4 flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#1f5bc0]"
        >
          <Search size={16} /> Search Resumes
        </button>
      </div>

      {submitted && <Results rows={results} />}
    </>
  );
}

function PeopleSearch({ candidates }: { candidates: EnrichedCandidate[] }) {
  const [field, setField] = useState<"phone" | "email" | "name" | "id">("phone");
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const results = useMemo(() => {
    if (!submitted || !q.trim()) return [];
    const terms = q.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    return candidates.filter((c) => {
      const vals =
        field === "phone"
          ? [c.phone, c.alt_phone]
          : field === "email"
            ? [c.email, c.alt_email]
            : field === "name"
              ? [c.name]
              : [c.id];
      const hay = vals.filter(Boolean).join(" ").toLowerCase();
      return terms.some((t) => hay.includes(t));
    });
  }, [submitted, q, field, candidates]);

  const tabs = [
    ["phone", "Contact Search"],
    ["email", "Email Search"],
    ["name", "Name Search"],
    ["id", "Profile ID Search"],
  ] as const;

  return (
    <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
      <div className="mb-4 flex flex-wrap gap-2 border-b border-[#f0f3f8] pb-3">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setField(id); setSubmitted(false); }}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition"
            style={field === id ? { background: "#eef4fe", color: "#2a6fdb" } : { color: "#7a8696" }}
          >
            {label}
          </button>
        ))}
      </div>
      <label className={labelCls}>
        {field === "phone" ? "Contact / Mobile Number" : field === "email" ? "Email" : field === "name" ? "Candidate Name" : "Profile ID"} (comma-separated)
      </label>
      <input value={q} onChange={(e) => setQ(e.target.value)} className={fieldCls} placeholder="Separated by commas" />
      <button
        onClick={() => setSubmitted(true)}
        className="mt-4 flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#1f5bc0]"
      >
        <Search size={16} /> Search Resumes
      </button>
      {submitted && <Results rows={results} />}
    </div>
  );
}

function Results({ rows }: { rows: EnrichedCandidate[] }) {
  const { openDrawer } = useShell();
  return (
    <div className="mt-5">
      <div className="mb-3 text-[13px] font-bold text-[#42506b]">
        {rows.length} {rows.length === 1 ? "result" : "results"}
      </div>
      <div className="overflow-hidden rounded-[14px] border border-[#e9edf3] bg-white">
        {rows.map((c) => (
          <div
            key={c.id}
            onClick={() => openDrawer(c.id)}
            className="flex cursor-pointer items-center gap-3 border-b border-[#f0f3f8] p-[12px_16px] last:border-0 hover:bg-[#f9fbfe]"
          >
            <Avatar name={c.name} size={38} />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold">{c.name}</div>
              <div className="truncate text-[11.5px] font-medium text-[#8a94a6]">
                {[c.current_designation || c.jobTitle, c.current_company, c.location]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-[12px] font-bold text-[#16203a]">{c.exp_years}y exp</div>
              <div className="text-[11px] font-semibold text-[#16a34a]">{fmtSalary(c.expected_ctc_lpa)}</div>
            </div>
            <StageBadge stage={c.stageKey} />
          </div>
        ))}
        {rows.length === 0 && (
          <div className="p-8 text-center text-[13px] font-semibold text-[#a3acbd]">
            No matching profiles.
          </div>
        )}
      </div>
    </div>
  );
}
