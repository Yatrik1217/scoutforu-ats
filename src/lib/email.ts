import "server-only";
import nodemailer from "nodemailer";

// SMTP email. The company-wide mailbox is configured with env vars: SMTP_HOST,
// SMTP_PORT (465 SSL or 587 STARTTLS), SMTP_USER, SMTP_PASS (an app password),
// optional SMTP_FROM. Candidate-facing emails can instead send through the
// acting recruiter's own mailbox by passing a MailAccount (see lib/user-mail).

export function emailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function fromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "";
}

// A mailbox to send through. `fromName`/`replyTo` let a shared mailbox still be
// stamped as an individual recruiter when they haven't set up their own SMTP.
export type MailAccount = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName?: string;
  fromAddress?: string; // defaults to `user`
  replyTo?: string;
};

// The company mailbox from env (null when not configured).
export function envMailAccount(): MailAccount | null {
  if (!emailConfigured()) return null;
  return {
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT || 465),
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    fromAddress: process.env.SMTP_FROM || process.env.SMTP_USER!,
    fromName: process.env.SMTP_FROM_NAME || undefined,
  };
}

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };

export async function sendMail(
  opts: {
    to: string;
    cc?: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: MailAttachment[];
    replyTo?: string;
  },
  account?: MailAccount | null,
): Promise<void> {
  const a = account ?? envMailAccount();
  if (!a) throw new Error("No mailbox configured to send from.");
  const transport = nodemailer.createTransport({
    host: a.host,
    port: a.port,
    secure: a.port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: a.user, pass: a.pass },
  });
  const addr = a.fromAddress || a.user;
  const from = a.fromName ? `"${a.fromName}" <${addr}>` : addr;
  await transport.sendMail({
    from,
    replyTo: opts.replyTo || a.replyTo || undefined,
    to: opts.to,
    cc: opts.cc || undefined,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
  });
}
