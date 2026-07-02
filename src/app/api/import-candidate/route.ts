import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Import a candidate from an external source (Naukri Resdex extension / bookmarklet).
// Authenticated with a per-recruiter API token, not a login session.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-api-token",
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: CORS });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const digits10 = (s: string) => (s || "").replace(/\D/g, "").slice(-10);

export async function POST(req: NextRequest) {
  const token =
    req.headers.get("x-api-token") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "Missing API token" }, 401);

  let sb;
  try {
    sb = createServiceClient();
  } catch {
    return json({ ok: false, error: "Server not configured for import" }, 500);
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, active")
    .eq("api_token", token)
    .maybeSingle();
  if (!profile || profile.active === false || profile.role === "client")
    return json({ ok: false, error: "Invalid or unauthorized token" }, 401);

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const s = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
  const n = (v: unknown) => {
    const x = parseFloat(String(v ?? ""));
    return Number.isFinite(x) ? x : 0;
  };
  const name = s(b.name);
  if (!name) return json({ ok: false, error: "name is required" }, 400);

  const email = s(b.email).toLowerCase();
  const phone = digits10(s(b.phone));

  // Duplicate check (email or phone, incl. alternates)
  const { data: existing } = await sb
    .from("candidates")
    .select("id,name,email,phone,alt_email,alt_phone");
  for (const c of existing ?? []) {
    const emails = [c.email, c.alt_email].filter(Boolean).map((x) => (x as string).toLowerCase());
    const phones = [c.phone, c.alt_phone].filter(Boolean).map((x) => digits10(x as string));
    if ((email && emails.includes(email)) || (phone.length >= 7 && phones.includes(phone)))
      return json({ ok: true, status: "duplicate", name, existing: c.name });
  }

  const skills = Array.isArray(b.skills) ? (b.skills as unknown[]).map(String) : [];
  const { data: created, error } = await sb
    .from("candidates")
    .insert({
      name,
      email: s(b.email) || null,
      phone: s(b.phone) || null,
      recruiter_id: profile.id,
      stage: "sourced",
      source: "Naukri Resdex",
      location: s(b.location) || null,
      exp_years: n(b.expYears),
      current_designation: s(b.currentDesignation),
      current_company: s(b.currentCompany),
      current_ctc_lpa: n(b.currentCtc),
      expected_ctc_lpa: n(b.expectedCtc),
      notice_period_days: n(b.noticePeriod),
      tags: skills,
    })
    .select("id")
    .single();

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, status: "created", name, candidateId: created.id });
}
