import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractFromText, extractFromFile, type ParsedResume } from "@/lib/ai/extract";

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

// Merge two parsed results field-by-field, preferring `primary`'s non-empty
// values (the actual resume file) and filling gaps from `fallback` (page text).
function mergeParsed(
  primary: ParsedResume | null,
  fallback: ParsedResume | null,
): ParsedResume | null {
  if (!primary) return fallback;
  if (!fallback) return primary;
  const out = { ...fallback } as Record<string, unknown>;
  for (const [k, v] of Object.entries(primary as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      if (v.length) out[k] = v;
    } else if (typeof v === "number") {
      if (v) out[k] = v;
    } else if (v) {
      out[k] = v;
    }
  }
  return out as unknown as ParsedResume;
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

  // Decode an attached resume file (base64) if the extension captured one.
  let resumeBuf: Buffer | null = null;
  let resumeName = "resume.pdf";
  let resumeType = "application/pdf";
  const rf = b.resumeFile as Record<string, unknown> | undefined;
  if (rf && typeof rf.dataBase64 === "string" && rf.dataBase64.length > 100) {
    try {
      const buf = Buffer.from(rf.dataBase64, "base64");
      if (buf.length > 1000 && buf.length <= 8 * 1024 * 1024) {
        resumeBuf = buf;
        resumeName = s(rf.name) || resumeName;
        resumeType = s(rf.type) || resumeType;
      }
    } catch {
      /* ignore bad file */
    }
  }

  // Extract fields with the same Haiku engine the resume parser uses. Prefer the
  // actual resume file (most accurate); fall back to / fill gaps from page text.
  const [aiFile, aiText] = await Promise.all([
    resumeBuf ? extractFromFile(resumeBuf, resumeName, resumeType) : Promise.resolve(null),
    s(b.rawText) ? extractFromText(s(b.rawText)) : Promise.resolve(null),
  ]);
  const ai: ParsedResume | null = mergeParsed(aiFile, aiText);

  // Decide what résumé file to store: the original download if the extension
  // captured one, otherwise the rendered CV HTML snapshot from the page (which
  // Resdex always shows), so a résumé document is attached either way.
  let storeBuf = resumeBuf;
  let storeName = resumeName;
  let storeType = resumeType;
  if (!storeBuf) {
    const cvHtml = s(b.cvHtml);
    if (cvHtml.length > 500) {
      storeBuf = Buffer.from(cvHtml, "utf8");
      storeName = "resume.html";
      storeType = "text/html";
    }
  }

  // Store the résumé file so recruiters can view/download it later.
  let resumeUrl = "";
  if (storeBuf && storeBuf.length <= 8 * 1024 * 1024) {
    try {
      const ext = (storeName.split(".").pop() || "pdf").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "pdf";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("resumes")
        .upload(path, storeBuf, { contentType: storeType || undefined });
      if (!upErr) resumeUrl = path;
    } catch {
      /* storage optional */
    }
  }

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
      resume_url: resumeUrl,
      tags: skills,
    })
    .select("id")
    .single();

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, status: "created", name, candidateId: created.id, resume: !!resumeUrl });
}
