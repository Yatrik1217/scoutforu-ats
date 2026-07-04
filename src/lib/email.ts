import "server-only";
import nodemailer from "nodemailer";

// SMTP email via the recruiter's own mailbox (Zoho / Gmail / any SMTP).
// Configure with env vars: SMTP_HOST, SMTP_PORT (465 SSL or 587 STARTTLS),
// SMTP_USER, SMTP_PASS (an app-specific password), optional SMTP_FROM.

export function emailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function fromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "";
}

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };

export async function sendMail(opts: {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
}): Promise<void> {
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: fromAddress(),
    to: opts.to,
    cc: opts.cc || undefined,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
  });
}
