"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { emailConfigured, sendMail } from "@/lib/email";

// Bulk import from Excel/CSV: clients, job openings, candidates (profiles /
// applications) and recruiter logins. Admin-only. Fixed, documented templates —
// headers are matched case-insensitively and punctuation-insensitively.

export type ImportType = "clients" | "jobs" | "candidates" | "recruiters";

export type ImportRowResult = {
  row: number;
  label: string;
  status: "created" | "duplicate" | "error";
  detail?: string;
};

export type ImportResult = {
  ok: boolean;
  error?: string;
  summary?: { total: number; created: number; duplicates: number; errors: number };
  rows?: ImportRowResult[];
};

const MAX_ROWS = 500;
const MAX_FILE = 5 * 1024 * 1024;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const digits10 = (s: string) => (s || "").replace(/\D/g, "").slice(-10);

function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.text != null) return String(o.text);
    if (o.result != null) return String(o.result);
    if (o.hyperlink) return String(o.hyperlink);
    return "";
  }
  return String(v).trim();
}

// Minimal CSV parser (quoted fields, commas, newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

async function parseFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return parseCsv(buf.toString("utf8").replace(/^﻿/, ""));
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (r) => {
    const vals: string[] = [];
    const arr = r.values as unknown[]; // 1-indexed
    for (let c = 1; c < arr.length; c++) vals.push(cellText(arr[c]));
    if (vals.some((v) => v.trim() !== "")) rows.push(vals);
  });
  return rows;
}

// Turn sheet rows into objects keyed by normalized header.
function toRecords(rows: string[][]): { records: Record<string, string>[]; headers: string[] } {
  if (rows.length < 2) return { records: [], headers: rows[0] ?? [] };
  const headers = rows[0].map((h) => norm(h));
  const records = rows.slice(1, MAX_ROWS + 1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) o[h] = (r[i] ?? "").trim();
    });
    return o;
  });
  return { records, headers: rows[0] };
}

const num = (v: string) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};

function genPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

export async function importData(type: ImportType, formData: FormData): Promise<ImportResult> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "master_admin") return { ok: false, error: "Only the Master Admin can import data" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to import" };
  if (file.size > MAX_FILE) return { ok: false, error: "File too large (max 5 MB)" };

  let sheet: string[][];
  try {
    sheet = await parseFile(file);
  } catch {
    return { ok: false, error: "Could not read this file — use .xlsx or .csv" };
  }
  const { records } = toRecords(sheet);
  if (!records.length)
    return { ok: false, error: "No data rows found (first row must be the column headers)" };

  const emailCreds = formData.get("emailCredentials") === "true";
  const results: ImportRowResult[] = [];
  const add = (row: number, label: string, status: ImportRowResult["status"], detail?: string) =>
    results.push({ row, label, status, detail });

  if (type === "clients") {
    const { data: existing } = await sb.from("clients").select("name");
    const names = new Set((existing ?? []).map((c) => norm(c.name)));
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const name = r["name"] || r["clientname"] || r["company"] || "";
      if (!name) {
        add(i + 2, "(blank)", "error", "Name is required");
        continue;
      }
      if (names.has(norm(name))) {
        add(i + 2, name, "duplicate", "Client already exists");
        continue;
      }
      const { error } = await sb.from("clients").insert({
        name,
        city: r["city"] || "",
        industry: r["industry"] || "",
        contact_email: r["contactemail"] || r["email"] || null,
        contact_number: r["contactnumber"] || r["phone"] || r["mobile"] || "",
        website: r["website"] || "",
        address: r["address"] || "",
        remarks: r["remarks"] || r["notes"] || "",
      });
      if (error) add(i + 2, name, "error", error.message);
      else {
        names.add(norm(name));
        add(i + 2, name, "created");
      }
    }
  }

  if (type === "jobs") {
    const [{ data: existing }, { data: clients }, { data: profiles }] = await Promise.all([
      sb.from("jobs").select("title,reference_code"),
      sb.from("clients").select("id,name"),
      sb.from("profiles").select("id,email").neq("role", "client"),
    ]);
    const refs = new Set((existing ?? []).map((j) => norm(j.reference_code)).filter((x) => x));
    const titles = new Set((existing ?? []).map((j) => norm(j.title)));
    const clientByName = new Map((clients ?? []).map((c) => [norm(c.name), c.id]));
    const recByEmail = new Map((profiles ?? []).map((p) => [p.email.toLowerCase(), p.id]));
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const title = r["title"] || r["jobtitle"] || r["position"] || "";
      if (!title) {
        add(i + 2, "(blank)", "error", "Title is required");
        continue;
      }
      const ref = r["referencecode"] || r["reference"] || "";
      if ((ref && refs.has(norm(ref))) || (!ref && titles.has(norm(title)))) {
        add(i + 2, title, "duplicate", "Job already exists");
        continue;
      }
      const statusRaw = (r["status"] || "open").toLowerCase();
      const { error } = await sb.from("jobs").insert({
        title,
        dept: r["department"] || r["dept"] || "",
        location: r["location"] || r["city"] || "",
        openings: Math.max(1, Math.round(num(r["openings"] || "1"))),
        min_ctc_lpa: num(r["minctclpa"] || r["minctc"] || "0"),
        max_ctc_lpa: num(r["maxctclpa"] || r["maxctc"] || "0"),
        exp_min: num(r["minexp"] || r["expmin"] || "0"),
        exp_max: num(r["maxexp"] || r["expmax"] || "0"),
        client_id: clientByName.get(norm(r["clientname"] || r["client"] || "")) ?? null,
        recruiter_id: recByEmail.get((r["recruiteremail"] || "").toLowerCase()) ?? null,
        reference_code: ref,
        description: r["description"] || "",
        status: statusRaw === "hot" ? "hot" : statusRaw === "closed" ? "closed" : "open",
        posted_at: new Date().toISOString(),
      });
      if (error) add(i + 2, title, "error", error.message);
      else {
        if (ref) refs.add(norm(ref));
        titles.add(norm(title));
        add(i + 2, title, "created");
      }
    }
  }

  if (type === "candidates") {
    const [{ data: existing }, { data: jobs }] = await Promise.all([
      sb.from("candidates").select("email,phone,alt_email,alt_phone"),
      sb.from("jobs").select("id,title,reference_code"),
    ]);
    const emails = new Set<string>();
    const phones = new Set<string>();
    for (const c of existing ?? []) {
      for (const e of [c.email, c.alt_email]) if (e) emails.add(String(e).toLowerCase());
      for (const p of [c.phone, c.alt_phone]) {
        const d = digits10(String(p ?? ""));
        if (d.length === 10) phones.add(d);
      }
    }
    const jobByKey = new Map<string, string>();
    for (const j of jobs ?? []) {
      if (j.reference_code) jobByKey.set(norm(j.reference_code), j.id);
      jobByKey.set(norm(j.title), j.id);
    }
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const name = r["name"] || r["candidatename"] || r["fullname"] || "";
      if (!name) {
        add(i + 2, "(blank)", "error", "Name is required");
        continue;
      }
      const email = (r["email"] || r["emailid"] || "").toLowerCase();
      const phone = r["phone"] || r["mobile"] || r["contactnumber"] || "";
      const p10 = digits10(phone);
      if ((email && emails.has(email)) || (p10.length === 10 && phones.has(p10))) {
        add(i + 2, name, "duplicate", "Same email/phone already in ATS");
        continue;
      }
      const jobKey = norm(r["jobreference"] || r["jobtitle"] || r["job"] || "");
      const { error } = await sb.from("candidates").insert({
        name,
        email: email || null,
        phone: phone || null,
        job_id: jobKey ? (jobByKey.get(jobKey) ?? null) : null,
        recruiter_id: user.id,
        stage: "sourced",
        source: r["source"] || "Import",
        location: r["location"] || r["city"] || null,
        exp_years: num(r["experienceyrs"] || r["experience"] || r["expyears"] || "0"),
        current_ctc_lpa: num(r["currentctclpa"] || r["currentctc"] || "0"),
        expected_ctc_lpa: num(r["expectedctclpa"] || r["expectedctc"] || "0"),
        notice_period_days: Math.round(num(r["noticedays"] || r["noticeperiod"] || "0")),
        current_designation: r["designation"] || r["currentdesignation"] || "",
        current_company: r["company"] || r["currentcompany"] || "",
        tags: (r["skills"] || "")
          .split(/[,;|]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 25),
      });
      if (error) add(i + 2, name, "error", error.message);
      else {
        if (email) emails.add(email);
        if (p10.length === 10) phones.add(p10);
        add(i + 2, name, "created");
      }
    }
  }

  if (type === "recruiters") {
    let svc;
    try {
      svc = createServiceClient();
    } catch {
      return { ok: false, error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" };
    }
    const colors = ["#2a6fdb", "#8b5cf6", "#06b6d4", "#f59e0b", "#16a34a", "#ef4444", "#ec4899"];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const name = r["name"] || r["recruitername"] || r["fullname"] || "";
      const email = (r["email"] || r["emailid"] || r["username"] || "").toLowerCase();
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        add(i + 2, name || email || "(blank)", "error", "Name and a valid email are required");
        continue;
      }
      const password = r["password"] && r["password"].length >= 8 ? r["password"] : genPassword();
      const { error } = await svc.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role: "recruiter",
          color: colors[i % colors.length],
          client_id: "",
        },
      });
      if (error) {
        add(i + 2, name, /already/i.test(error.message) ? "duplicate" : "error",
          /already/i.test(error.message) ? "User already exists" : error.message);
        continue;
      }
      let detail = `temp password: ${password}`;
      if (emailCreds && emailConfigured()) {
        try {
          await sendMail({
            to: email,
            subject: "Your ScoutforU ATS login",
            html: `<div style="font:14px/1.6 system-ui,Arial,sans-serif;color:#16203a"><p>Hi ${name},</p><p>Your ScoutforU ATS recruiter account is ready:</p><p><b>URL:</b> https://scoutforu-ats.vercel.app<br><b>Email:</b> ${email}<br><b>Temporary password:</b> ${password}</p></div>`,
          });
          detail += " · credentials emailed";
        } catch {
          detail += " · email failed — share manually";
        }
      }
      add(i + 2, `${name} <${email}>`, "created", detail);
    }
  }

  revalidatePath("/", "layout");
  const summary = {
    total: results.length,
    created: results.filter((r) => r.status === "created").length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    errors: results.filter((r) => r.status === "error").length,
  };
  return { ok: true, summary, rows: results };
}
