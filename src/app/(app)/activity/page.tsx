import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { Avatar } from "@/components/bits";

export const dynamic = "force-dynamic";

const IST = "Asia/Kolkata";
const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
const dayLabel = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { ws, scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/overview");

  const span = Number((await searchParams).d) === 30 ? 30 : 14;
  // Last `span` IST days, oldest → newest.
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

  // added[recId|day] = candidates that recruiter added that day
  // sub[recId|day]   = candidates that recruiter submitted to client that day
  const added = new Map<string, number>();
  const sub = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const c of ws.candidates) {
    const day = istDay(c.created_at);
    if (daySet.has(day)) bump(added, `${c.recruiter_id ?? "none"}|${day}`);
  }
  for (const e of ws.events) {
    if (e.to_stage !== "client_submit") continue;
    const day = istDay(e.created_at);
    if (!daySet.has(day)) continue;
    const cand = ws.byId.get(e.candidate_id);
    bump(sub, `${cand?.recruiter_id ?? "none"}|${day}`);
  }

  const rowFor = (recId: string) => {
    const perDay = days.map((d) => ({
      added: added.get(`${recId}|${d}`) ?? 0,
      sub: sub.get(`${recId}|${d}`) ?? 0,
    }));
    return {
      perDay,
      totAdded: perDay.reduce((s, x) => s + x.added, 0),
      totSub: perDay.reduce((s, x) => s + x.sub, 0),
    };
  };

  // Inline template so the column count is honored at runtime (Tailwind can't
  // JIT a class with an interpolated repeat()).
  const gridStyle = {
    gridTemplateColumns: `1.3fr repeat(${span}, minmax(30px, 1fr)) 66px`,
  };

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            Daily Activity
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            Per-recruiter <b className="text-[#16a34a]">candidates added</b> and{" "}
            <b className="text-[#2a6fdb]">submissions to client</b>, day by day.
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

      <div className="overflow-x-auto rounded-2xl border border-[#e9edf3] bg-white">
        <div className="min-w-max">
          <div className="grid gap-1 border-b border-[#eef1f6] bg-[#f8fafc] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#8a94a6]" style={gridStyle}>
            <div>Recruiter</div>
            {days.map((d) => (
              <div key={d} className={`text-center ${d === todayISO ? "text-[#2a6fdb]" : ""}`}>
                {dayLabel(d).replace(" ", " ")}
              </div>
            ))}
            <div className="text-right">Total</div>
          </div>

          {recruiters.map((r) => {
            const row = rowFor(r.id);
            return (
              <div
                key={r.id}
                className="grid items-center gap-1 border-b border-[#f4f6fa] px-4 py-2.5 last:border-0" style={gridStyle}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={r.name} size={26} />
                  <div className="truncate text-[12.5px] font-bold text-[#16203a]">{r.name}</div>
                </div>
                {row.perDay.map((x, i) => (
                  <div
                    key={i}
                    className={`rounded-[6px] py-1 text-center ${days[i] === todayISO ? "bg-[#eef4fe]" : x.added || x.sub ? "bg-[#f7f9fc]" : ""}`}
                    title={`${dayLabel(days[i])}: ${x.added} added, ${x.sub} submitted`}
                  >
                    <div className="tf-num text-[12px] font-extrabold leading-none text-[#2a6fdb]">
                      {x.sub || (x.added ? "" : "·")}
                    </div>
                    {x.added > 0 && (
                      <div className="tf-num text-[9.5px] font-semibold leading-tight text-[#16a34a]">
                        +{x.added}
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-right leading-tight">
                  <div className="tf-num text-[13px] font-extrabold text-[#2a6fdb]">{row.totSub}</div>
                  <div className="tf-num text-[10px] font-semibold text-[#16a34a]">+{row.totAdded}</div>
                </div>
              </div>
            );
          })}
          {recruiters.length === 0 && (
            <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
              No recruiters yet.
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-[12px] text-[#8a94a6]">
        Big <b className="text-[#2a6fdb]">blue</b> = submissions to client that day · small{" "}
        <b className="text-[#16a34a]">green +N</b> = new candidates added. Today is highlighted.
        Submissions are counted when a candidate enters the <b>Client Submit</b> stage.
      </p>
    </div>
  );
}
