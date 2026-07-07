"use server";

import { createClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms";

type Result = { ok: boolean; error?: string; message?: string };

export async function sendTestSms(phone: string): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "master_admin") return { ok: false, error: "Admin only" };

  const err = await sendSms(phone, "ScoutforU ATS — test SMS. Your gateway is working.");
  if (err) return { ok: false, error: err };
  return { ok: true, message: `Test SMS sent to ${phone}` };
}
