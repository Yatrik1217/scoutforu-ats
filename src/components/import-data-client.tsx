"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Download, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { importData, type ImportType, type ImportResult } from "@/lib/actions/import-data";

type Tab = {
  key: ImportType;
  label: string;
  desc: string;
  headers: string[];
  example: string[];
  note?: string;
};

const TABS: Tab[] = [
  {
    key: "candidates",
    label: "Candidates / Applications",
    desc: "Import candidate profiles. Fill the optional Job Reference column (job title or reference code) to attach them to a job — that covers application imports too.",
    headers: [
      "Name", "Email", "Phone", "Location", "Experience (yrs)", "Current CTC (LPA)",
      "Expected CTC (LPA)", "Notice (days)", "Designation", "Company", "Skills", "Source", "Job Reference",
    ],
    example: [
      "Rahul Nair", "rahul.nair@gmail.com", "9876543210", "Gurgaon", "5", "12", "18",
      "30", "Backend Engineer", "Zomato", "Node.js, Postgres, AWS", "Naukri", "HR Executive",
    ],
    note: "Duplicates (same email or phone) are skipped automatically.",
  },
  {
    key: "jobs",
    label: "Job Openings",
    desc: "Import open positions. Client Name and Recruiter Email link the job to an existing client/recruiter when they match.",
    headers: [
      "Title", "Department", "Location", "Openings", "Min CTC (LPA)", "Max CTC (LPA)",
      "Min Exp", "Max Exp", "Client Name", "Recruiter Email", "Reference Code", "Status", "Description",
    ],
    example: [
      "HR Executive", "Human Resources", "Ahmedabad", "2", "3", "5", "1", "3",
      "Acme Corp", "yashashvi.shah@scoutforu.com", "SFU-101", "open", "Looking for an HR executive…",
    ],
    note: "Status: open, hot or closed. Duplicate reference codes/titles are skipped.",
  },
  {
    key: "clients",
    label: "Clients",
    desc: "Import client companies.",
    headers: ["Name", "City", "Industry", "Contact Email", "Contact Number", "Website", "Address", "Remarks"],
    example: ["Acme Corp", "Mumbai", "IT Services", "hr@acme.com", "+91 9800000000", "https://acme.com", "BKC, Mumbai", "Key account"],
    note: "Existing client names are skipped.",
  },
  {
    key: "recruiters",
    label: "Recruiters",
    desc: "Create recruiter logins in bulk. Leave Password empty to auto-generate a strong one — it's shown in the result (and optionally emailed to them).",
    headers: ["Name", "Email", "Password"],
    example: ["Priya Sharma", "priya@scoutforu.com", ""],
    note: "Passwords must be 8+ characters if you provide your own.",
  },
];

const csvEsc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function ImportDataClient({ smtpConfigured }: { smtpConfigured: boolean }) {
  const [tab, setTab] = useState<Tab>(TABS[0]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [emailCreds, setEmailCreds] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csv = "﻿" + tab.headers.map(csvEsc).join(",") + "\n" + tab.example.map(csvEsc).join(",") + "\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab.key}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("emailCredentials", String(emailCreds));
    setResult(null);
    start(async () => {
      const res = await importData(tab.key, fd);
      if (!res.ok) {
        toast.error(res.error || "Import failed");
        return;
      }
      setResult(res);
      const s = res.summary!;
      toast.success(`Imported ${s.created} of ${s.total} rows (${s.duplicates} duplicates, ${s.errors} errors)`);
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-[10px] bg-[#f1f4f9] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t);
              setResult(null);
            }}
            className={`flex-1 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold transition ${
              tab.key === t.key ? "bg-white text-[#16203a] shadow-sm" : "text-[#8a94a6]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
        <p className="text-[13px] text-[#42506b]">{tab.desc}</p>
        {tab.note && <p className="mt-1 text-[12px] text-[#8a94a6]">{tab.note}</p>}

        <div className="mt-3 overflow-x-auto rounded-[10px] border border-[#eef1f6]">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-[#f7f9fc]">
                {tab.headers.map((h) => (
                  <th key={h} className="whitespace-nowrap p-[7px_10px] text-left font-bold text-[#6b7686]">
                    {h}
                    {(h === "Name" || (tab.key === "recruiters" && h === "Email") || (tab.key === "jobs" && h === "Title")) && (
                      <span className="text-[#dc2626]">*</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {tab.example.map((v, i) => (
                  <td key={i} className="whitespace-nowrap border-t border-[#f0f3f8] p-[7px_10px] text-[#9aa4b6]">
                    {v || "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {tab.key === "recruiters" && smtpConfigured && (
          <label className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold text-[#42506b]">
            <input
              type="checkbox"
              checked={emailCreds}
              onChange={(e) => setEmailCreds(e.target.checked)}
              className="h-4 w-4 accent-[#2a6fdb]"
            />
            Email each recruiter their login details
          </label>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 rounded-[9px] border border-[#e6eaf1] bg-white px-4 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            <Download size={15} /> Download template
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {pending ? "Importing…" : "Upload .xlsx / .csv"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {result?.summary && (
        <div className="mt-4 rounded-[12px] border border-[#e9edf3] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-extrabold text-[#16203a]">
            <FileSpreadsheet size={16} /> Result — {result.summary.created} created,{" "}
            {result.summary.duplicates} duplicates, {result.summary.errors} errors
          </div>
          <div className="max-h-[340px] overflow-auto rounded-[10px] border border-[#eef1f6]">
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0">
                <tr className="bg-[#f7f9fc]">
                  <th className="p-[7px_10px] text-left font-bold text-[#6b7686]">Row</th>
                  <th className="p-[7px_10px] text-left font-bold text-[#6b7686]">Record</th>
                  <th className="p-[7px_10px] text-left font-bold text-[#6b7686]">Status</th>
                  <th className="p-[7px_10px] text-left font-bold text-[#6b7686]">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.rows?.map((r, i) => (
                  <tr key={i} className="border-t border-[#f0f3f8]">
                    <td className="tf-num p-[6px_10px] text-[#9aa4b6]">{r.row}</td>
                    <td className="p-[6px_10px] font-semibold text-[#16203a]">{r.label}</td>
                    <td className="p-[6px_10px]">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                          r.status === "created"
                            ? "bg-[#ecfdf3] text-[#17a673]"
                            : r.status === "duplicate"
                              ? "bg-[#fffbeb] text-[#b45309]"
                              : "bg-[#fef2f2] text-[#dc2626]"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-[6px_10px] text-[#6b7686]">{r.detail ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
