import { format } from "date-fns";
import { CalendarDays, PartyPopper } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP_TIMEZONE } from "@/lib/hr";
import type { HolidayRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function MyHolidaysPage() {
  await requireProfile();
  const sb = await createClient();

  // Show the current calendar year's holiday calendar.
  const todayISO = new Date().toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
  const year = Number(todayISO.slice(0, 4));
  const { data: holData } = await sb
    .from("holidays")
    .select("*")
    .gte("on_date", `${year}-01-01`)
    .lte("on_date", `${year}-12-31`)
    .order("on_date", { ascending: true });
  const holidays = (holData ?? []) as HolidayRow[];

  const past = holidays.filter((h) => h.on_date < todayISO);
  const upcoming = holidays.filter((h) => h.on_date >= todayISO);
  const next = upcoming.find((h) => h.on_date > todayISO) ?? null;

  const stats = [
    { label: `Holidays in ${year}`, value: holidays.length, color: "#8b5cf6" },
    { label: "Still to come", value: upcoming.length, color: "#16a34a" },
    { label: "Already passed", value: past.length, color: "#a3acbd" },
  ];

  const Row = ({ h }: { h: HolidayRow }) => {
    const d = new Date(h.on_date + "T00:00:00");
    const isToday = h.on_date === todayISO;
    const isPast = h.on_date < todayISO;
    return (
      <div
        className={`grid grid-cols-[62px_1fr_110px] items-center gap-3 border-b border-[#f4f6fa] px-5 py-3.5 last:border-0 ${
          isPast ? "opacity-55" : ""
        }`}
      >
        <div
          className={`flex h-[50px] w-[52px] flex-col items-center justify-center rounded-xl ${
            isToday ? "bg-[#8b5cf6] text-white" : "bg-[#f3eefe] text-[#8b5cf6]"
          }`}
        >
          <span className="tf-num text-[18px] font-extrabold leading-none">{format(d, "dd")}</span>
          <span className="text-[10px] font-bold uppercase">{format(d, "MMM")}</span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-bold text-[#16203a]">
            {h.name || "Holiday"}
          </div>
          <div className="text-[12px] font-medium text-[#8a94a6]">{format(d, "EEEE")}</div>
        </div>
        <div className="text-right">
          {isToday ? (
            <span className="rounded-full bg-[#e9f9ef] px-2.5 py-1 text-[11px] font-bold text-[#16a34a]">
              Today
            </span>
          ) : isPast ? (
            <span className="rounded-full bg-[#f1f4f9] px-2.5 py-1 text-[11px] font-bold text-[#a3acbd]">
              Passed
            </span>
          ) : (
            <span className="rounded-full bg-[#eef4fe] px-2.5 py-1 text-[11px] font-bold text-[#2a6fdb]">
              Upcoming
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
          Holidays
        </h1>
        <p className="text-[13px] text-[#8a94a6]">
          Company holiday calendar for {year} · non-working days
        </p>
      </div>

      {/* next holiday highlight */}
      {next && (
        <div className="mb-[18px] flex items-center gap-3.5 rounded-2xl border border-[#e4d9fb] bg-[#faf8ff] p-[16px_20px]">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-[#8b5cf6] text-white">
            <PartyPopper size={20} />
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wide text-[#8b5cf6]">
              Next holiday
            </div>
            <div className="text-[15px] font-extrabold text-[#16203a]">
              {next.name || "Holiday"} ·{" "}
              {format(new Date(next.on_date + "T00:00:00"), "EEEE, dd MMM")}
            </div>
          </div>
        </div>
      )}

      <div className="mb-[18px] grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#e9edf3] bg-white p-[18px]">
            <div className="font-display tf-num text-[26px] font-extrabold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="mt-px text-[12.5px] font-semibold text-[#7a8696]">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="flex items-center gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[12px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <CalendarDays size={14} /> {year} Holiday list
        </div>
        {holidays.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
            No holidays have been added for {year} yet.
          </div>
        ) : (
          <>
            {upcoming.map((h) => (
              <Row key={h.id} h={h} />
            ))}
            {past.map((h) => (
              <Row key={h.id} h={h} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
