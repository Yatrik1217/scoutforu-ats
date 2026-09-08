import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data";
import { recruiterMetrics } from "@/lib/team-metrics";
import { renderDigest } from "@/lib/team-digest-email";
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
