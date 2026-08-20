"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendMail, emailConfigured } from "@/lib/email";
import { recruiterMailAccount } from "@/lib/user-mail";
import { sendSms, smsProvider } from "@/lib/sms";
import { renderTemplate } from "@/lib/template-render";

type Result = { ok: boolean; error?: string; message?: string };

// Templates recruiters can pick from in the "Message" box (read = any staff).
export async function listEmailTemplates(): Promise<
  { id: string; name: string; subject: string; body: string }[]
> {
  const sb = await createClient();
  const { data } = await sb
    .from("email_templates")
    .select("id,name,subject,body")
    .order("name");
  return data ?? [];
}

const esc = (s: string) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);


// Send an email and/or SMS to a candidate from inside the ATS, using the
// company's configured SMTP + SMS provider, and log it to the candidate's
// activity so the team can see it happened.
export async function messageCandidate(input: {
  candidateId: string;
  channel: "email" | "sms" | "both";
  subject?: string;
  body: string;
}): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const rawBody = (input.body || "").trim();
  if (!rawBody) return { ok: false, error: "Write a message first." };

  const { data: cand } = await sb
    .from("candidates")
    .select("id, name, email, phone, job_id")
    .eq("id", input.candidateId)
    .maybeSingle();
  if (!cand) return { ok: false, error: "Candidate not found." };

  // Resolve the job title + client (for {{job_title}} / {{client_name}}) and the
  // sender's name (for {{sender_name}}) so templates render fully personalised.
  let jobTitle = "";
  let clientName = "";
  if (cand.job_id) {
    const { data: job } = await sb
      .from("jobs")
      .select("title, client_id")
      .eq("id", cand.job_id)
      .maybeSingle();
    jobTitle = job?.title ?? "";
    if (job?.client_id) {
      const { data: client } = await sb
        .from("clients")
        .select("name")
        .eq("id", job.client_id)
        .maybeSingle();
      clientName = client?.name ?? "";
    }
  }
  const { data: sender } = await sb
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  const first = (cand.name || "").trim().split(/\s+/)[0] || "";
  const vars: Record<string, string> = {
    name: cand.name || "",
    candidate_name: cand.name || "",
    first_name: first,
    job_title: jobTitle || "the position",
    client_name: clientName,
    sender_name: sender?.name || "ScoutforU Team",
  };

  const body = renderTemplate(rawBody, vars);
  const subjectFilled = renderTemplate(input.subject || "", vars);

  // Send from the acting recruiter's own mailbox (falls back to the shared
  // mailbox stamped with their name + reply-to).
  const mailAccount = await recruiterMailAccount(sb, user.id);

  const wantEmail = input.channel === "email" || input.channel === "both";
  const wantSms = input.channel === "sms" || input.channel === "both";
  const sent: string[] = [];
  const failed: string[] = [];

  if (wantEmail) {
    if (!cand.email) failed.push("no email on file");
    else if (!emailConfigured()) failed.push("email isn't set up (ask your admin)");
    else {
      try {
        const subject = subjectFilled.trim() || "A message regarding your application";
        const html = `<div style="font:14px/1.65 Arial,Helvetica,sans-serif;color:#1a1a1a;white-space:pre-wrap">${esc(body)}</div>`;
        await sendMail({ to: cand.email, subject, html, text: body }, mailAccount);
        sent.push("email");
      } catch (e) {
        failed.push("email failed: " + (e as Error).message);
      }
    }
  }

  if (wantSms) {
    if (!cand.phone) failed.push("no phone on file");
    else if (!smsProvider()) failed.push("SMS isn't set up (ask your admin)");
    else {
      const err = await sendSms(cand.phone, body); // null = success, string = error
      if (err) failed.push("SMS: " + err);
      else sent.push("SMS");
    }
  }

  // Activity log (best-effort — never block the send on it).
  if (sent.length) {
    const head = input.subject ? `${input.subject} — ` : "";
    const { error } = await sb.from("candidate_notes").insert({
      candidate_id: cand.id,
      author_id: user.id,
      body: `📤 Sent ${sent.join(" + ")}: ${head}${body.slice(0, 400)}`,
    });
    void error;
  }

  revalidatePath("/", "layout");

  if (sent.length && !failed.length) return { ok: true, message: `Sent ${sent.join(" + ")} ✓` };
  if (sent.length) return { ok: true, message: `Sent ${sent.join(" + ")} — but ${failed.join("; ")}` };
  return { ok: false, error: failed.join("; ") || "Nothing was sent." };
}
