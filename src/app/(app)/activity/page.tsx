import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { ActivityGrid } from "@/components/activity-grid";

export const dynamic = "force-dynamic";

const IST = "Asia/Kolkata";
const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });

type Person = { id: string; name: string };

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { ws, scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/overview");

  const span = Number((await searchParams).d) === 30 ? 30 : 14;
  const todayISO = new Date().toLocaleDateString("en-CA", { timeZone: IST });
  const days: string[] = [];
  {
    const base = new Date(todayISO + "T00:00:00Z");
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
  }
  const daySet = new Set(days);
  const recruiters = ws.team.filter((p) => p.role !== "client");

  // Per (recruiter, day): the actual candidates added, and submitted to client.
  const added = new Map<string, Person[]>();
  const sub = new Map<string, Person[]>();
  const push = (m: Map<string, Person[]>, k: string, v: Person) => {
    const a = m.get(k) ?? [];
    a.push(v);
    m.set(k, a);
  };

  for (const c of ws.candidates) {
    const day = istDay(c.created_at);
    if (daySet.has(day)) push(added, `${c.recruiter_id ?? "none"}|${day}`, { id: c.id, name: c.name });
  }
  for (const e of ws.events) {
    if (e.to_stage !== "client_submit") continue;
    const day = istDay(e.created_at);
    if (!daySet.has(day)) continue;
    const cand = ws.byId.get(e.candidate_id);
    if (cand) push(sub, `${cand.recruiter_id ?? "none"}|${day}`, { id: cand.id, name: cand.name });
  }

  const rows = recruiters.map((r) => {
    const dayCells = days.map((d) => ({
      day: d,
      added: added.get(`${r.id}|${d}`) ?? [],
      sub: sub.get(`${r.id}|${d}`) ?? [],
    }));
    return {
      id: r.id,
      name: r.name,
      days: dayCells,
      totAdded: dayCells.reduce((s, x) => s + x.added.length, 0),
      totSub: dayCells.reduce((s, x) => s + x.sub.length, 0),
    };
  });

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            Daily Activity
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            Per-recruiter <b className="text-[#16a34a]">candidates added</b> and{" "}
            <b className="text-[#2a6fdb]">submissions to client</b>, day by day —{" "}
            <b>click any cell to see the names</b>.
          </p>
        </div>
        <div className="flex gap-1 rounded-[10px] bg-[#eef1f6] p-[3px]">
          {[14, 30].map((n) => (
            <a
              key={n}
              href={`/activity?d=${n}`}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition ${span === n ? "bg-white text-[#2a6fdb] shadow-[0_1px_3px_rgba(20,40,80,.12)]" : "text-[#7a8696]"}`}
            >
              {n} days
            </a>
          ))}
        </div>
      </div>

      <ActivityGrid rows={rows} days={days} todayISO={todayISO} span={span} />

      <p className="mt-3 text-[12px] text-[#8a94a6]">
        Big <b className="text-[#2a6fdb]">blue</b> = submissions to client that day · small{" "}
        <b className="text-[#16a34a]">green +N</b> = new candidates added. Submissions are counted
        when a candidate enters the <b>Client Submit</b> stage. Today is highlighted.
      </p>
    </div>
  );
}
