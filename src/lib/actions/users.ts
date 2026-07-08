"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { emailConfigured, sendMail } from "@/lib/email";

type Result = { ok: boolean; error?: string; message?: string };

const AVATAR_COLORS = ["#2a6fdb", "#8b5cf6", "#06b6d4", "#f59e0b", "#16a34a", "#ef4444", "#ec4899", "#0ea5e9"];

// Admin-only: create a login (auth user). The on_auth_user_created trigger
// builds the profile row from the metadata we pass.
export async function addUser(input: {
  name: string;
  email: string;
  password: string;
  role: "recruiter" | "client";
  clientId?: string | null;
  emailCredentials?: boolean;
}): Promise<Result> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Name is required" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email" };
  if ((input.password || "").length < 8)
    return { ok: false, error: "Password must be at least 8 characters" };
  if (input.role === "client" && !input.clientId)
    return { ok: false, error: "Pick the client company this login belongs to" };

  // Only a Master Admin may create users.
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "master_admin") return { ok: false, error: "Only the Master Admin can add users" };

  let svc;
  try {
    svc = createServiceClient();
  } catch {
    return { ok: false, error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" };
  }

  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const { error } = await svc.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name,
      role: input.role,
      color,
      client_id: input.role === "client" ? input.clientId : "",
    },
  });
  if (error) {
    const msg = /already/i.test(error.message)
      ? "A user with this email already exists"
      : error.message;
    return { ok: false, error: msg };
  }

  // Optionally email the credentials (only when SMTP is configured).
  let mailed = false;
  if (input.emailCredentials && emailConfigured()) {
    try {
      await sendMail({
        to: email,
        subject: "Your ScoutforU ATS login",
        html: `<div style="font:14px/1.6 system-ui,Arial,sans-serif;color:#16203a">
<p>Hi ${name},</p>
<p>Your ScoutforU ATS account is ready:</p>
<p><b>URL:</b> https://scoutforu-ats.vercel.app<br>
<b>Email:</b> ${email}<br>
<b>Temporary password:</b> ${input.password}</p>
<p>Please sign in and keep your password safe.</p></div>`,
      });
      mailed = true;
    } catch {
      /* account created; mailing is best-effort */
    }
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${name} added as ${input.role === "recruiter" ? "Recruiter" : "Client user"}${mailed ? " — credentials emailed" : ""}`,
  };
}
