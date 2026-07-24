"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { updateAttendanceSettings } from "@/lib/actions/hr";
import { NumberInput } from "@/components/number-input";
import { formatShiftTime } from "@/lib/hr";
import type { AttendanceSettingsRow } from "@/lib/database.types";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";
const lbl = "block text-[12px] font-bold text-[#42506b]";

export function AttendanceSettingsForm({ settings }: { settings: AttendanceSettingsRow | null }) {
  const [shiftStart, setShiftStart] = useState(settings?.shift_start ?? "10:00");
  const [shiftEnd, setShiftEnd] = useState(settings?.shift_end ?? "19:00");
  const [grace, setGrace] = useState(settings?.grace_minutes ?? 10);
  const [fullDay, setFullDay] = useState(settings?.full_day_hours ?? 8);
  const [halfDay, setHalfDay] = useState(settings?.half_day_hours ?? 4);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await updateAttendanceSettings({
        shiftStart,
        shiftEnd,
        graceMinutes: grace,
        fullDayHours: fullDay,
        halfDayHours: halfDay,
      });
      if (res.ok) toast.success(res.message || "Saved");
      else toast.error(res.error || "Failed");
    });

  const valid = /^([01]?\d|2[0-3]):[0-5]\d$/;

  return (
    <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>
          Shift start (24-hour)
          <input value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className={field + " mt-1 font-normal"} placeholder="10:00" />
          {valid.test(shiftStart) && (
            <span className="mt-1 block text-[11px] font-medium text-[#a3acbd]">
              {formatShiftTime(shiftStart)}
            </span>
          )}
        </label>
        <label className={lbl}>
          Shift end (24-hour)
          <input value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className={field + " mt-1 font-normal"} placeholder="19:00" />
          {valid.test(shiftEnd) && (
            <span className="mt-1 block text-[11px] font-medium text-[#a3acbd]">
              {formatShiftTime(shiftEnd)}
            </span>
          )}
        </label>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <label className={lbl}>
          Grace (min)
          <NumberInput value={grace} decimals={false} onChange={setGrace} className={field + " mt-1 font-normal"} />
          <span className="mt-1 block text-[11px] font-medium text-[#a3acbd]">
            Arriving up to this late still counts on-time.
          </span>
        </label>
        <label className={lbl}>
          Full day (net hrs)
          <NumberInput value={fullDay} onChange={setFullDay} className={field + " mt-1 font-normal"} />
        </label>
        <label className={lbl}>
          Half day below (hrs)
          <NumberInput value={halfDay} onChange={setHalfDay} className={field + " mt-1 font-normal"} />
        </label>
      </div>
      <div className="mt-4 rounded-[10px] bg-[#f8fafc] px-4 py-3 text-[12px] text-[#7a8696]">
        Standard shift{" "}
        <b className="text-[#16203a]">
          {valid.test(shiftStart) ? formatShiftTime(shiftStart) : "—"} –{" "}
          {valid.test(shiftEnd) ? formatShiftTime(shiftEnd) : "—"}
        </b>
        . Attendance flags anyone arriving more than {grace} min late or working under {fullDay}{" "}
        net hours. These are shown for information — payroll is not auto-docked by short hours.
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
        >
          <Save size={15} /> {pending ? "Saving…" : "Save work hours"}
        </button>
      </div>
    </div>
  );
}
