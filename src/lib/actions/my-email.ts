"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendMail, type MailAccount } from "@/lib/email";

type Result = { ok: boolean; error?: string; message?: string };

// Non-secret view of a recruiter's own mailbox (never returns the password).
export type MyEmailSettings = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  from_name: string;
  verified: boolean;
  configured: boolean;
};

export async function getMyEmailSettings(): Promise<MyEmailSettings | null> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("user_email_settings")
    .select("smtp_host,smtp_port,smtp_user,from_name,verified")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    smtp_host: data.smtp_host,
    smtp_port: data.smtp_port,
    smtp_user: data.smtp_user,
    from_name: data.from_name,
    verified: data.verified,
    configured: !!(data.smtp_host && data.smtp_user),
  };
}

export type MyEmailForm = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string; // blank on edit = keep the existing password
  from_name: string;
};

export async function saveMyEmailSettings(form: MyEmailForm): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const host = form.smtp_host.trim();
  const smtpUser = form.smtp_user.trim();
  const port = Number(form.smtp_port) || 465;
  if (!host || !smtpUser) return { ok: false, error: "SMTP host and username are required." };

  // Keep the existing password if the field was left blank on an edit.
  let pass = form.smtp_pass.trim();
  if (!pass) {
    const { data: existing } = await sb
      .from("user_email_settings")
      .select("smtp_pass")
      .eq("user_id", user.id)
      .maybeSingle();
    pass = existing?.smtp_pass ?? "";
  }
  if (!pass) return { ok: false, error: "An app password is required." };

  const { error } = await sb.from("user_email_settings").upsert(
    {
      user_id: user.id,
      smtp_host: host,
      smtp_port: port,
      smtp_user: smtpUser,
      smtp_pass: pass,
      from_name: form.from_name.trim(),
      verified: false, // must re-test after any change
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/my/email");
  return { ok: true, message: "Saved — send a test to verify." };
}

// Send a test email through the recruiter's OWN mailbox and, on success, mark it
// verified. Surfaces the SMTP error so the user can fix host/port/password.
export async function sendTestEmail(): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const [{ data: s }, { data: prof }] = await Promise.all([
    sb
      .from("user_email_settings")
      .select("smtp_host,smtp_port,smtp_user,smtp_pass,from_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    sb.from("profiles").select("name,email").eq("id", user.id).maybeSingle(),
  ]);
  if (!s || !s.smtp_host || !s.smtp_user || !s.smtp_pass)
    return { ok: false, error: "Save your SMTP details first." };

  const account: MailAccount = {
    host: s.smtp_host,
    port: s.smtp_port || 465,
    user: s.smtp_user,
    pass: s.smtp_pass,
    fromAddress: s.smtp_user,
    fromName: s.from_name || prof?.name || "",
  };
  const to = prof?.email || s.smtp_user;
  try {
    await sendMail(
      {
        to,
        subject: "ScoutforU ATS — test email ✓",
        html: `<p>This is a test from your ScoutforU ATS mailbox.</p><p>If you received this, candidate emails will now send from <b>${s.smtp_user}</b>.</p>`,
        text: `Test from your ScoutforU ATS mailbox. Candidate emails will now send from ${s.smtp_user}.`,
      },
      account,
    );
  } catch (e) {
    return { ok: false, error: "Send failed: " + (e as Error).message };
  }
  await sb.from("user_email_settings").update({ verified: true }).eq("user_id", user.id);
  revalidatePath("/my/email");
  return { ok: true, message: `Test sent to ${to} ✓ — your mailbox is verified.` };
}

export async function clearMyEmailSettings(): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const { error } = await sb.from("user_email_settings").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/my/email");
  return { ok: true, message: "Removed — emails will send from the shared mailbox again." };
}
