import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { envMailAccount, type MailAccount } from "@/lib/email";

type SB = Awaited<ReturnType<typeof createClient>>;

// Resolve the mailbox a candidate-facing email should send through, given the
// acting recruiter. Preference order:
//   1. The recruiter's OWN SMTP (they configured it under My Email) — the email
//      genuinely comes from their address.
//   2. The shared company mailbox, but stamped with the recruiter's name and a
//      reply-to of their address, so replies still reach them.
//   3. Whatever env provides (last resort).
//
// A recruiter can only read their own settings row (RLS), which is exactly the
// person we're sending as — so the session client is sufficient, no service key.
export async function recruiterMailAccount(
  sb: SB,
  userId: string | null | undefined,
): Promise<MailAccount | null> {
  if (!userId) return envMailAccount();

  const [{ data: prof }, { data: s }] = await Promise.all([
    sb.from("profiles").select("name,email").eq("id", userId).maybeSingle(),
    sb
      .from("user_email_settings")
      .select("smtp_host,smtp_port,smtp_user,smtp_pass,from_name")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  // 1. The recruiter's own mailbox.
  if (s && s.smtp_host && s.smtp_user && s.smtp_pass) {
    return {
      host: s.smtp_host,
      port: s.smtp_port || 465,
      user: s.smtp_user,
      pass: s.smtp_pass,
      fromAddress: s.smtp_user,
      fromName: s.from_name || prof?.name || "",
      replyTo: s.smtp_user,
    };
  }

  // 2. Shared mailbox, stamped as the recruiter.
  const env = envMailAccount();
  if (!env) return null;
  return {
    ...env,
    fromName: prof?.name || env.fromName,
    replyTo: prof?.email || undefined,
  };
}
