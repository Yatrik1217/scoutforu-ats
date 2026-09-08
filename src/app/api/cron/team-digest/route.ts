import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data";
import { recruiterMetrics, STALL_DAYS, type RecruiterMetric } from "@/lib/team-metrics";
import { sendMail, emailConfigured } from "@/lib/email";
import type { EffectiveScope } from "@/lib/preview";

export const dynamic = "force-dynamic";

// Daily recruiting summary email. Triggered by a VPS cron (see /opt) with a
// shared secret — there is no user session, so it reads via the service role.
//   GET /api/cron/team-digest?key=<CRON_SECRET>
//   (or Authorization: Bearer <CRON_SECRET>)
// Recipients: env DIGEST_TO (comma-separated) else every active master admin.

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const key = new URL(req.url).searchParams.get("key") || "";
  const provided = bearer || key;
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!emailConfigured()) {
    return NextResponse.json({ ok: false, sent: false, reason: "email not configured" });
  }

  const sb = createServiceClient();
  const scope: EffectiveScope = {
    role: "master_admin",
    realRole: "master_admin",
    isPreview: false,
    previewClientId: null,
    userId: "cron",
    scopeLabel: "cron",
  };
  const ws = await getWorkspace(scope, sb);
  const metrics = recruiterMetrics(ws);

  // Recipients.
  const envTo = (process.env.DIGEST_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const to =
    envTo.length > 0
      ? envTo
      : ws.team
          .filter((p) => p.role === "master_admin" && p.active && p.email)
          .map((p) => p.email);
  if (to.length === 0) {
    return NextResponse.json({ ok: false, sent: false, reason: "no recipients" });
  }

  const asOf = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const html = renderDigest(metrics, asOf);
  const totalActive = metrics.reduce((n, m) => n + m.active, 0);
  const totalStalled = metrics.reduce((n, m) => n + m.stalled, 0);
  const subject = `Recruiting summary · ${asOf} · ${totalActive} active${
    totalStalled ? ` · ${totalStalled} stalled` : ""
  }`;

  await sendMail({ to: to.join(", "), subject, html });

  return NextResponse.json({
    ok: true,
    sent: true,
    recipients: to.length,
    recruiters: metrics.length,
    totalActive,
    totalStalled,
  });
}

// ---------- email HTML (inline styles for mail-client compatibility) ----------

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function stat(label: string, value: string | number, color = "#16203a"): string {
  return `<td align="center" style="padding:4px 10px;">
    <div style="font:800 18px Arial,sans-serif;color:${color};">${value}</div>
    <div style="font:600 10px Arial,sans-serif;color:#9aa4b6;text-transform:uppercase;letter-spacing:.4px;">${esc(label)}</div>
  </td>`;
}

function recruiterBlock(m: RecruiterMetric): string {
  const stalledBadge = m.stalled
    ? `<span style="background:#fdecec;color:#dc2626;font:700 11px Arial;padding:2px 8px;border-radius:20px;margin-left:8px;">⚠ ${m.stalled} stalled</span>`
    : "";
  const openings = m.openings.length
    ? m.openings
        .slice(0, 8)
        .map(
          (o) => `<tr>
            <td style="font:700 13px Arial,sans-serif;color:#16203a;padding:6px 0;">${esc(o.title)}${
              o.stalled ? ` <span style="color:#dc2626;font:700 11px Arial;">(⚠ ${o.stalled})</span>` : ""
            }<div style="font:600 11px Arial;color:#8a94a6;">${esc(
              [o.clientName, o.dept].filter(Boolean).join(" · ") || "—",
            )}</div></td>
            <td align="right" style="font:800 16px Arial,sans-serif;color:#2a6fdb;white-space:nowrap;">${o.active} <span style="font:600 10px Arial;color:#9aa4b6;">cand.</span></td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="2" style="font:600 12px Arial;color:#9aa4b6;padding:6px 0;">No active candidates right now.</td></tr>`;
  const more =
    m.openings.length > 8
      ? `<tr><td colspan="2" style="font:600 11px Arial;color:#9aa4b6;padding-top:4px;">+ ${m.openings.length - 8} more openings…</td></tr>`
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9edf3;border-radius:14px;margin:0 0 16px;">
    <tr><td style="padding:16px 18px;">
      <div style="font:800 16px Arial,sans-serif;color:#16203a;">${esc(m.name)}${stalledBadge}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;background:#f7f9fc;border-radius:10px;">
        <tr>
          ${stat("Active", m.active, "#2a6fdb")}
          ${stat("Openings", m.openings.length, "#16203a")}
          ${stat("Hires", m.hires, "#16a34a")}
          <td style="border-left:1px solid #e6eaf1;"></td>
          ${stat("Wk sub.", m.week.submitted)}
          ${stat("Wk intv.", m.week.interviews)}
          ${stat("Wk off.", m.week.offers)}
          ${stat("Wk hire", m.week.hires, "#16a34a")}
          <td style="border-left:1px solid #e6eaf1;"></td>
          ${stat("Intv %", m.conv.interviewPct + "%", "#8b5cf6")}
          ${stat("Offer %", m.conv.offerPct + "%", "#d9730d")}
          ${stat("Hire %", m.conv.hirePct + "%", "#16a34a")}
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
        ${openings}${more}
      </table>
    </td></tr>
  </table>`;
}

function renderDigest(metrics: RecruiterMetric[], asOf: string): string {
  const totalActive = metrics.reduce((n, m) => n + m.active, 0);
  const totalStalled = metrics.reduce((n, m) => n + m.stalled, 0);
  return `<!doctype html><html><body style="margin:0;background:#eef1f6;padding:22px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;">
      <tr><td style="padding:0 4px 14px;">
        <div style="font:800 20px Arial,sans-serif;color:#16203a;">Daily Recruiting Summary</div>
        <div style="font:600 13px Arial,sans-serif;color:#8a94a6;">${esc(asOf)} · ${totalActive} active across the team${
          totalStalled ? ` · ${totalStalled} stalled (idle > ${STALL_DAYS} days)` : ""
        }</div>
      </td></tr>
      <tr><td>${metrics.map(recruiterBlock).join("")}</td></tr>
      <tr><td style="padding:6px 4px;font:600 11px Arial,sans-serif;color:#aab2c0;">
        “Stalled” = active candidates sitting in a stage longer than ${STALL_DAYS} days. Conversion % is over everyone each recruiter has handled. Open the ATS → Recruiting Team for the interactive view.
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}
