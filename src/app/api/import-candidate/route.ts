import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractFromText, type ParsedResume } from "@/lib/ai/extract";

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

// Reject non-candidate "chrome" emails that appear on every Resdex page (the
// recruiter's own posting inbox, Naukri support, role addresses) so they don't
// poison dedupe / candidate data.
const ROLE_LOCAL =
  /^(careers?|jobs?|hr|recruit(?:ing|ment)?|talent|info|support|help|contact|care|sales|admin|noreply|no-?reply|donotreply|do-?not-?reply|mailer|team|hello|enquir(?:y|ies)|hiring|webmaster|office|feedback)$/i;
const JUNK_DOMAIN = /(?:^|\.)(naukri|infoedge|resdex)\.[a-z.]+$/i;
function cleanEmail(v: string): string {
  const e = (v || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return "";
  const [local, domain] = e.split("@");
  if (ROLE_LOCAL.test(local) || JUNK_DOMAIN.test(domain)) return "";
  return e;
}

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

  // When the extension sends the raw profile text, run the same Haiku extractor
  // the resume parser uses — far more reliable than page-scraping selectors.
  let ai: ParsedResume | null = null;
  const rawText = s(b.rawText);
  if (rawText) ai = await extractFromText(rawText);

  // Prefer explicitly-scraped values (unlocked contacts etc.), fall back to AI.
  const pickS = (scraped: unknown, aiVal?: string) => s(scraped) || (aiVal ?? "");
  const pickN = (scraped: unknown, aiVal?: number) => n(scraped) || (aiVal ?? 0);

  const name = pickS(b.name, ai?.name);
  if (!name) return json({ ok: false, error: "name is required" }, 400);

  const email = cleanEmail(pickS(b.email, ai?.email));
  const phoneRaw = pickS(b.phone, ai?.phone);
  const phone = digits10(phoneRaw);
  const phoneValid = phone.length === 10; // Indian mobile

  // Duplicate check (email or phone, incl. alternates)
  const { data: existing } = await sb
    .from("candidates")
    .select("id,name,email,phone,alt_email,alt_phone");
  for (const c of existing ?? []) {
    const emails = [c.email, c.alt_email].filter(Boolean).map((x) => (x as string).toLowerCase());
    const phones = [c.phone, c.alt_phone]
      .filter(Boolean)
      .map((x) => digits10(x as string))
      .filter((p) => p.length === 10);
    if ((email && emails.includes(email)) || (phoneValid && phones.includes(phone)))
      return json({ ok: true, status: "duplicate", name, existing: c.name });
  }

  const skills =
    Array.isArray(b.skills) && b.skills.length
      ? (b.skills as unknown[]).map(String)
      : ai?.skills ?? [];
  const birthDate = pickS(b.birthDate, ai?.birthDate);

  const { data: created, error } = await sb
    .from("candidates")
    .insert({
      name,
      email: email || null,
      phone: phoneValid ? phoneRaw : null,
      recruiter_id: profile.id,
      stage: "sourced",
      source: "Naukri Resdex",
      location: pickS(b.location, ai?.location) || null,
      exp_years: pickN(b.expYears, ai?.expYears),
      current_designation: pickS(b.currentDesignation, ai?.currentDesignation),
      current_company: pickS(b.currentCompany, ai?.currentCompany),
      current_ctc_lpa: pickN(b.currentCtc, ai?.currentCtc),
      expected_ctc_lpa: pickN(b.expectedCtc, ai?.expectedCtc),
      notice_period_days: pickN(b.noticePeriod, ai?.noticePeriod),
      alt_email: pickS(b.altEmail, ai?.altEmail),
      alt_phone: pickS(b.altPhone, ai?.altPhone),
      gender: pickS(b.gender, ai?.gender),
      graduation: pickS(b.graduation, ai?.graduation),
      post_graduation: pickS(b.postGraduation, ai?.postGraduation),
      marital_status: pickS(b.maritalStatus, ai?.maritalStatus),
      birth_date: birthDate || null,
      function: pickS(b.function, ai?.function),
      industry: pickS(b.industry, ai?.industry),
      tags: skills,
    })
    .select("id")
    .single();

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, status: "created", name, candidateId: created.id });
}
