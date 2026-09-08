import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { recruiterMetrics, STALL_DAYS } from "@/lib/team-metrics";
import { TeamBoard, type RecruiterCard } from "@/components/team-board";

export default async function TeamPage() {
  const { ws, scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/overview");

  const cards: RecruiterCard[] = recruiterMetrics(ws).map((m) => {
    const pct = Math.min(100, Math.round((m.active / 8) * 100));
    return {
      id: m.id,
      name: m.name,
      isActive: m.isActive,
      activeCount: m.active,
      stalledCount: m.stalled,
      interviews: m.interviews,
      hires: m.hires,
      pct,
      barColor: pct > 80 ? "#ef4444" : pct > 55 ? "#f59e0b" : "#16a34a",
      openings: m.openings,
      week: m.week,
      conv: m.conv,
    };
  });

  const asOf = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <TeamBoard recruiters={cards} asOf={asOf} stallDays={STALL_DAYS} />
    </div>
  );
}
