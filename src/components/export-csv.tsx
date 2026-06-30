"use client";

import { Download } from "lucide-react";

type Row = Record<string, string | number | null | undefined>;

function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
}

export function ExportCsvButton({
  rows,
  filename,
  label = "Export CSV",
}: {
  rows: Row[];
  filename: string;
  label?: string;
}) {
  const onClick = () => {
    const csv = "﻿" + toCsv(rows); // BOM so Excel reads UTF-8 (₹, etc.)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={onClick}
      disabled={!rows.length}
      className="flex items-center gap-2 rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb] disabled:opacity-50"
    >
      <Download size={15} />
      {label}
    </button>
  );
}
