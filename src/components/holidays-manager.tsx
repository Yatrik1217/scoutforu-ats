"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { addHoliday, deleteHoliday } from "@/lib/actions/hr";
import type { HolidayRow } from "@/lib/database.types";

const field =
  "rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";

export function HolidaysManager({ holidays }: { holidays: HolidayRow[] }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      const res = await addHoliday(date, name);
      if (res.ok) {
        toast.success(res.message || "Added");
        setDate("");
        setName("");
      } else toast.error(res.error || "Failed");
    });

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteHoliday(id);
      if (res.ok) toast.success(res.message || "Removed");
      else toast.error(res.error || "Failed");
    });

  const sorted = [...holidays].sort((a, b) => (a.on_date < b.on_date ? 1 : -1));

  return (
    <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
      <div className="text-[14px] font-extrabold text-[#16203a]">Holidays</div>
      <p className="mt-0.5 text-[12px] text-[#8a94a6]">
        National / company holidays. A listed day never counts as absent and shows as
        <b> Holiday</b> on the register.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-[12px] font-bold text-[#42506b]">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field + " mt-1 block font-normal"} />
        </label>
        <label className="flex-1 text-[12px] font-bold text-[#42506b]">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Independence Day"
            className={field + " mt-1 block w-full font-normal"}
          />
        </label>
        <button
          onClick={add}
          disabled={pending || !date}
          className="flex items-center gap-1.5 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
        >
          <CalendarPlus size={15} /> Add
        </button>
      </div>

      <div className="mt-4 divide-y divide-[#f0f3f8]">
        {sorted.length === 0 && (
          <div className="py-6 text-center text-[12.5px] font-semibold text-[#a3acbd]">
            No holidays added yet.
          </div>
        )}
        {sorted.map((h) => (
          <div key={h.id} className="flex items-center gap-3 py-2.5">
            <div className="w-[110px] text-[12.5px] font-bold text-[#16203a]">
              {format(new Date(h.on_date + "T00:00:00"), "dd MMM yyyy")}
            </div>
            <div className="flex-1 text-[12.5px] text-[#42506b]">{h.name || "Holiday"}</div>
            <button
              onClick={() => remove(h.id)}
              disabled={pending}
              title="Remove"
              className="rounded-lg border border-[#eadfe0] bg-[#fafafa] p-1.5 text-[#9aa4b6] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
