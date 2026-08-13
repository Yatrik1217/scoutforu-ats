"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  Users,
  Sparkles,
  ArrowUpRight,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";

export type CareerJob = {
  id: string;
  title: string;
  dept: string;
  location: string;
  type: string;
  exp_min: number;
  exp_max: number;
  openings: number;
  description: string;
  posted_at: string;
};
type Org = { name: string; tagline: string; logo_url: string } | null;

const typeLabel = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const since = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
const snippet = (s: string, n = 160) => {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
};

export function CareersBrowser({ org, jobs }: { org: Org; jobs: CareerJob[] }) {
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const name = org?.name || "ScoutforU Consultants";

  const filtered = useMemo(() => {
    const kw = q.toLowerCase().trim();
    const lc = loc.toLowerCase().trim();
    return jobs.filter((j) => {
      if (kw && !`${j.title} ${j.dept} ${j.description}`.toLowerCase().includes(kw)) return false;
      if (lc && !j.location.toLowerCase().includes(lc)) return false;
      return true;
    });
  }, [jobs, q, loc]);

  const locations = useMemo(
    () => [...new Set(jobs.map((j) => j.location).filter(Boolean))],
    [jobs],
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#16203a]">
      {/* Hero */}
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#1f5bc0_0%,#2a6fdb_52%,#123f8f_100%)] text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="relative mx-auto max-w-[1000px] px-6 pt-8 pb-32">
          <div className="flex items-center gap-3">
            {org?.logo_url ? (
              // On a white chip so the logo never gets lost against the hero.
              <span className="inline-flex items-center rounded-[12px] bg-white px-3 py-2 shadow-[0_4px_14px_rgba(0,0,0,.12)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={org.logo_url} alt={name} className="h-9 w-auto max-w-[170px] object-contain" />
              </span>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-[16px] font-extrabold text-[#2a6fdb]">
                {name.charAt(0)}
              </div>
            )}
            <span className="text-[16px] font-extrabold tracking-tight text-white/95">{name}</span>
          </div>

          <div className="mt-12 max-w-[660px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold">
              <Sparkles size={13} /> We&apos;re hiring
            </span>
            <h1 className="mt-4 text-[34px] font-extrabold leading-[1.1] sm:text-[44px]">
              Find a role you&apos;ll love.
            </h1>
            <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-white/85">
              {jobs.length} open position{jobs.length === 1 ? "" : "s"} across our teams and clients.
              Apply in minutes — no account, no long forms.
            </p>
          </div>
        </div>
      </div>

      {/* Search bar (overlaps hero) */}
      <div className="mx-auto -mt-14 max-w-[1000px] px-6">
        <div className="flex flex-col gap-2 rounded-[18px] border border-[#e9edf3] bg-white p-2.5 shadow-[0_18px_44px_rgba(20,32,58,.14)] sm:flex-row">
          <div className="flex flex-[1.4] items-center gap-2.5 rounded-[12px] bg-[#f4f7fb] px-4">
            <Search size={18} className="shrink-0 text-[#8a94a6]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search role, skill or department"
              className="w-full bg-transparent py-3.5 text-[14px] font-medium outline-none placeholder:text-[#9aa4b6]"
            />
          </div>
          <div className="flex flex-1 items-center gap-2.5 rounded-[12px] bg-[#f4f7fb] px-4">
            <MapPin size={18} className="shrink-0 text-[#8a94a6]" />
            <input
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder="Location"
              list="career-locations"
              className="w-full bg-transparent py-3.5 text-[14px] font-medium outline-none placeholder:text-[#9aa4b6]"
            />
            <datalist id="career-locations">
              {locations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {/* Results */}
      <main className="mx-auto max-w-[1000px] px-6 py-9">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="text-[14px] font-bold text-[#42506b]">
            {filtered.length} open position{filtered.length === 1 ? "" : "s"}
            {(q || loc) && <span className="font-medium text-[#8a94a6]"> matching your search</span>}
          </div>
          <div className="flex gap-0.5 rounded-[10px] border border-[#e6eaf1] bg-white p-0.5">
            <ViewBtn active={view === "grid"} onClick={() => setView("grid")} icon={LayoutGrid} label="Grid" />
            <ViewBtn active={view === "list"} onClick={() => setView("list")} icon={ListIcon} label="List" />
          </div>
        </div>

        {filtered.length ? (
          <div className={view === "grid" ? "grid gap-4 md:grid-cols-2" : "mx-auto flex max-w-[720px] flex-col gap-3"}>
            {filtered.map((j) => (
              <Link
                key={j.id}
                href={`/careers/${j.id}`}
                className="group relative flex flex-col overflow-hidden rounded-[16px] border border-[#e9edf3] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c3d4f0] hover:shadow-[0_14px_34px_rgba(20,32,58,.10)]"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#1f5bc0,#5b96f0)] opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[16.5px] font-extrabold leading-snug">{j.title}</h3>
                  <span className="shrink-0 rounded-full bg-[#eafaf0] px-2.5 py-1 text-[10.5px] font-bold text-[#128a3e]">
                    Hiring now
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {j.dept && <Tag icon={Briefcase}>{j.dept}</Tag>}
                  {j.location && <Tag icon={MapPin}>{j.location}</Tag>}
                  {(j.exp_min || j.exp_max) > 0 && (
                    <Tag>
                      {j.exp_min}–{j.exp_max} yrs
                    </Tag>
                  )}
                  <Tag>{typeLabel(j.type)}</Tag>
                  {j.openings > 1 && <Tag icon={Users}>{j.openings} openings</Tag>}
                </div>

                {j.description && (
                  <p className="mt-3 text-[13px] leading-relaxed text-[#6b7686]">
                    {snippet(j.description)}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-[#f0f3f8] pt-3">
                  <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#9aa4b6]">
                    <Clock size={12} /> {since(j.posted_at)}
                  </span>
                  <span className="flex items-center gap-1 text-[12.5px] font-bold text-[#2a6fdb]">
                    View &amp; apply
                    <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[16px] border border-dashed border-[#d7dee8] bg-white p-12 text-center">
            <div className="text-[15px] font-bold text-[#42506b]">No roles match your search</div>
            <div className="mt-1 text-[13px] text-[#8a94a6]">
              Try a different keyword or clear the location.
            </div>
          </div>
        )}
      </main>

      {/* Drop-your-CV CTA */}
      <div className="mx-auto max-w-[1000px] px-6 pb-14">
        <div className="flex flex-col items-start gap-4 rounded-[20px] bg-[linear-gradient(135deg,#16203a,#26365a)] p-7 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[19px] font-extrabold">Don&apos;t see the right role?</div>
            <div className="mt-1 text-[13.5px] text-white/70">
              Reach out and we&apos;ll keep you in mind for future openings.
            </div>
          </div>
          <a
            href="#top"
            className="shrink-0 rounded-[12px] bg-white px-6 py-3 text-[14px] font-extrabold text-[#16203a] transition hover:bg-white/90"
          >
            Browse all roles
          </a>
        </div>
      </div>

      <footer className="border-t border-[#e9edf3] py-8 text-center text-[12px] text-[#9aa4b6]">
        © {new Date().getFullYear()} {name} · Careers powered by ScoutforU ATS
      </footer>
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] font-bold transition"
      style={active ? { background: "#eef4fe", color: "#2a6fdb" } : { color: "#8a94a6" }}
    >
      <Icon size={15} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Tag({ icon: Icon, children }: { icon?: typeof MapPin; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-[#f1f4f9] px-2 py-[3px] text-[11px] font-semibold text-[#556680]">
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}
