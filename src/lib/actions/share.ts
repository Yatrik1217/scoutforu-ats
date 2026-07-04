"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { emailConfigured, fromAddress, sendMail, type MailAttachment } from "@/lib/email";

type Result = { ok: boolean; error?: string; message?: string };

const prettyStage = (slug: string) =>
  (slug || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const safeFile = (s: string, fallback = "resume") =>
  (s || fallback).replace(/[^\w .-]+/g, " ").trim() || fallback;

const escapeHtml = (s: string) =>
  (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);

export async function shareWithClient(input: {
  candidateIds: string[];
  to: string;
  cc?: string;
  subject?: string;
  message?: string;
}): Promise<Result> {
  const to = (input.to || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to))
    return { ok: false, error: "Enter a valid client email address." };
  if (!input.candidateIds?.length) return { ok: false, error: "Select at least one candidate." };
  if (!emailConfigured())
    return {
      ok: false,
      error: "Email is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in the server env.",
    };

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await sb.from("profiles").select("role, name").eq("id", user.id).maybeSingle();
  if (!me || me.role === "client") return { ok: false, error: "Not authorized to share candidates." };

  // RLS scopes this to candidates the user may see.
  const { data: cands, error } = await sb
    .from("candidates")
    .select(
      "id,name,email,phone,location,exp_years,current_ctc_lpa,expected_ctc_lpa,notice_period_days,current_designation,current_company,stage,source,tags,resume_url",
    )
    .in("id", input.candidateIds);
  if (error) return { ok: false, error: error.message };
  if (!cands?.length) return { ok: false, error: "No candidates found to share." };

  // Build the Excel tracker.
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Candidates");
  ws.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Designation", key: "designation", width: 24 },
    { header: "Company", key: "company", width: 22 },
    { header: "Experience (yrs)", key: "exp", width: 15 },
    { header: "Current CTC (LPA)", key: "cctc", width: 16 },
    { header: "Expected CTC (LPA)", key: "ectc", width: 17 },
    { header: "Notice (days)", key: "notice", width: 13 },
    { header: "Location", key: "location", width: 18 },
    { header: "Email", key: "email", width: 26 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Stage", key: "stage", width: 16 },
    { header: "Source", key: "source", width: 16 },
    { header: "Skills", key: "skills", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F8" } };
  for (const c of cands) {
    ws.addRow({
      name: c.name,
      designation: c.current_designation || "",
      company: c.current_company || "",
      exp: c.exp_years || 0,
      cctc: c.current_ctc_lpa || 0,
      ectc: c.expected_ctc_lpa || 0,
      notice: c.notice_period_days || 0,
      location: c.location || "",
      email: c.email || "",
      phone: c.phone || "",
      stage: prettyStage(c.stage),
      source: c.source || "",
      skills: (c.tags || []).join(", "),
    });
  }
  const xlsxBuf = Buffer.from(await wb.xlsx.writeBuffer());

  const attachments: MailAttachment[] = [
    {
      filename: `Candidate Tracker (${cands.length}).xlsx`,
      content: xlsxBuf,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  ];

  // Attach each candidate's résumé (downloaded via service role from the bucket).
  const svc = createServiceClient();
  const used = new Set<string>();
  for (const c of cands) {
    if (!c.resume_url) continue;
    try {
      const { data: blob } = await svc.storage.from("resumes").download(c.resume_url);
      if (!blob) continue;
      const ab = await blob.arrayBuffer();
      const ext = (c.resume_url.split(".").pop() || "pdf").toLowerCase();
      let fname = `${safeFile(c.name)}.${ext}`;
      let n = 2;
      while (used.has(fname.toLowerCase())) fname = `${safeFile(c.name)} (${n++}).${ext}`;
      used.add(fname.toLowerCase());
      attachments.push({ filename: fname, content: Buffer.from(ab) });
    } catch {
      /* skip unreadable résumé */
    }
  }

  const subject = (input.subject || "").trim() || `Candidate submission — ${cands.length} profile${cands.length > 1 ? "s" : ""}`;
  const intro = (input.message || "").trim();
  const list = cands
    .map(
      (c) =>
        `<li><b>${escapeHtml(c.name)}</b>${c.current_designation ? " — " + escapeHtml(c.current_designation) : ""}${
          c.exp_years ? " · " + c.exp_years + "y" : ""
        }${c.location ? " · " + escapeHtml(c.location) : ""}</li>`,
    )
    .join("");
  const html = `<div style="font:14px/1.6 system-ui,Arial,sans-serif;color:#16203a">
${intro ? `<p>${escapeHtml(intro).replace(/\n/g, "<br>")}</p>` : ""}
<p>Please find attached the candidate tracker (Excel) and ${cands.length} résumé${cands.length > 1 ? "s" : ""}.</p>
<ul>${list}</ul>
<p style="color:#7a8699;font-size:12px">Sent via ScoutforU ATS${me.name ? " by " + escapeHtml(me.name) : ""}.</p>
</div>`;

  try {
    await sendMail({ to, cc: (input.cc || "").trim() || undefined, subject, html, attachments });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send the email." };
  }

  // Log the share on each candidate's activity.
  const note = `Shared with client (${to}) — tracker + résumé emailed.`;
  await sb.from("candidate_notes").insert(
    cands.map((c) => ({ candidate_id: c.id, author_id: user.id, body: note })),
  );
  revalidatePath("/", "layout");

  const attachedResumes = attachments.length - 1;
  return {
    ok: true,
    message: `Sent to ${to} · ${cands.length} candidate${cands.length > 1 ? "s" : ""}, ${attachedResumes} résumé${attachedResumes === 1 ? "" : "s"} attached.`,
  };
}
