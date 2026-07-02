"use client";

import { CalendarPlus } from "lucide-react";

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

// Generates a standards-compliant .ics calendar file that Gmail, Zoho, and
// Outlook all recognise ("Add to calendar"). No email service required.
export function AddToCalendarButton({
  id,
  title,
  description,
  location,
  startIso,
  durationMin = 45,
}: {
  id: string;
  title: string;
  description: string;
  location: string;
  startIso: string;
  durationMin?: number;
}) {
  const download = (e: React.MouseEvent) => {
    e.stopPropagation();
    const end = new Date(new Date(startIso).getTime() + durationMin * 60000).toISOString();
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ScoutforU ATS//EN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${id}@scoutforu`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(startIso)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc(description)}`,
      `LOCATION:${esc(location || "")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={download}
      title="Add to calendar (Gmail / Zoho / Outlook)"
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6eaf1] text-[#7a8696] hover:bg-[#f6f8fb] hover:text-[#2a6fdb]"
    >
      <CalendarPlus size={15} />
    </button>
  );
}
