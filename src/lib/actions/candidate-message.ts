"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendMail, emailConfigured } from "@/lib/email";
import { sendSms, smsProvider } from "@/lib/sms";

type Result = { ok: boolean; error?: string; message?: string };

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

  const body = (input.body || "").trim();
  if (!body) return { ok: false, error: "Write a message first." };

  const { data: cand } = await sb
    .from("candidates")
    .select("id, name, email, phone")
    .eq("id", input.candidateId)
    .maybeSingle();
  if (!cand) return { ok: false, error: "Candidate not found." };

  const wantEmail = input.channel === "email" || input.channel === "both";
  const wantSms = input.channel === "sms" || input.channel === "both";
  const sent: string[] = [];
  const failed: string[] = [];

  if (wantEmail) {
    if (!cand.email) failed.push("no email on file");
    else if (!emailConfigured()) failed.push("email isn't set up (ask your admin)");
    else {
      try {
        const subject = (input.subject || "").trim() || "A message regarding your application";
        const html = `<div style="font:14px/1.65 Arial,Helvetica,sans-serif;color:#1a1a1a;white-space:pre-wrap">${esc(body)}</div>`;
        await sendMail({ to: cand.email, subject, html, text: body });
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
