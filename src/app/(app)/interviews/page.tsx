import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import { loadWorkspace } from "@/lib/data";
import { Avatar, RecBadge, TypePill, typeLabelFromEnum } from "@/components/bits";
import { OpenOnClick, NewInterviewButton } from "@/components/view-actions";

function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE");
}

export default async function InterviewsPage() {
  const { ws } = await loadWorkspace();

  const stats = [
    {
      label: "This Week",
      value: ws.interviews.filter((i) =>
        isThisWeek(new Date(i.scheduled_at), { weekStartsOn: 1 }),
      ).length,
      color: "#2a6fdb",
    },
    {
      label: "Today",
      value: ws.interviews.filter((i) => isToday(new Date(i.scheduled_at)))
        .length,
      color: "#8b5cf6",
    },
    {
      label: "Practical Rounds",
      value: ws.interviews.filter((i) => i.type === "practical").length,
      color: "#f59e0b",
    },
  ];

  const groups: { key: string; day: string; date: string; items: typeof ws.interviews }[] =
    [];
  for (const iv of ws.interviews) {
    const d = new Date(iv.scheduled_at);
    const key = format(d, "yyyy-MM-dd");
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, day: dayLabel(d), date: format(d, "MMM dd"), items: [] };
      groups.push(g);
    }
    g.items.push(iv);
  }

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-[18px] flex items-center justify-between">
        <div className="flex gap-3.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-[13px] border border-[#e9edf3] bg-white p-[13px_20px]"
            >
              <div
                className="tf-num text-[23px] font-extrabold"
                style={{ color: s.color }}
              >
                {s.value}
              </div>
              <div className="text-[11.5px] font-semibold text-[#8a94a6]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <NewInterviewButton />
      </div>

      <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
        {groups.map((g) => (
          <div key={g.key} className="mb-[22px] last:mb-0">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="text-[13.5px] font-extrabold">{g.day}</span>
              <span className="text-[12px] font-semibold text-[#9aa4b6]">
                {g.date}
              </span>
              <div className="h-px flex-1 bg-[#f0f3f8]" />
              <span className="tf-num text-[11.5px] font-bold text-[#a3acbd]">
                {g.items.length} interviews
              </span>
            </div>
            {g.items.map((iv) => {
              const c = ws.byId.get(iv.candidate_id);
              const interviewer = iv.interviewer_id
                ? ws.profileById.get(iv.interviewer_id)
                : null;
              return (
                <OpenOnClick
                  key={iv.id}
                  id={iv.candidate_id}
                  className="mb-2.5 flex cursor-pointer items-center gap-3.5 rounded-xl border border-[#eef1f6] p-[13px_14px] hover:border-[#c3d4f0] hover:bg-[#f9fbfe]"
                >
                  <div className="w-[58px] text-center text-[#2a6fdb]">
                    <div className="tf-num text-[13px] font-extrabold">
                      {format(new Date(iv.scheduled_at), "HH:mm")}
                    </div>
                  </div>
                  <Avatar name={c?.name ?? "—"} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold">{c?.name ?? "—"}</div>
                    <div className="text-[12px] font-medium text-[#8a94a6]">
                      {c?.jobTitle ?? ""}
                    </div>
                  </div>
                  <TypePill type={typeLabelFromEnum(iv.type)} />
                  <div className="flex w-[150px] items-center gap-1.5">
                    {interviewer && (
                      <RecBadge
                        name={interviewer.name}
                        color={interviewer.color}
                      />
                    )}
                    <span className="text-[12px] font-semibold text-[#42506b]">
                      {interviewer?.name ?? "—"}
                    </span>
                  </div>
                </OpenOnClick>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && (
          <div className="py-10 text-center text-[13px] font-semibold text-[#a3acbd]">
            No interviews scheduled yet.
          </div>
        )}
      </div>
    </div>
  );
}
