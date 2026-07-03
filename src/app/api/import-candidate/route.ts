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

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

// Naukri's rendered CV markup is full of layout junk (timeline widgets, empty
// nodes, pseudo "hover-style" text, lazy-loaded images). Convert it to clean,
// readable lines so the stored résumé is presentable rather than raw HTML.
const JUNK_LINE = /^(hover-style|no-hover|last-child|first-child|even|odd|["'“”\-•\s]*)$/i;
function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(div|p|li|tr|h[1-6]|section|header|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    // Strip Naukri tooltip pseudo-text artifacts wherever they appear inline.
    .replace(/\b(hover-style|no-hover|last-child|first-child)\b/gi, " ");
  return decodeEntities(withBreaks)
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l && !JUNK_LINE.test(l))
    .filter((l, i, arr) => l !== arr[i - 1]) // drop consecutive duplicates
    .join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

// Build a clean, printable résumé document from Naukri's rendered CV HTML.
function renderResumeDoc(name: string, cvHtml: string): string {
  const text = htmlToText(cvHtml);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name)} — CV</title><style>body{font:14px/1.65 system-ui,-apple-system,Arial,sans-serif;max-width:800px;margin:32px auto;padding:0 22px;color:#16203a}h1{font-size:22px;margin:0 0 2px}.sfu-src{color:#7a8699;font-size:12px;margin:0 0 20px}pre{white-space:pre-wrap;word-wrap:break-word;font:inherit;margin:0}@media print{body{margin:0}}</style></head><body><h1>${escapeHtml(name)}</h1><div class="sfu-src">Imported from Naukri Resdex · ScoutforU ATS</div><pre>${escapeHtml(text)}</pre></body></html>`;
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

  // The rendered CV HTML (cvHtml) is anchored to the candidate's own CV section,
  // whereas rawText can accidentally capture the "similar profiles" panel. Strip
  // the CV HTML to text and use whichever source is richer for extraction.
  const cvHtml = s(b.cvHtml);
  const cvText = cvHtml
    ? cvHtml
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
        .replace(/\s+/g, " ")
        .trim()
    : "";
  const rawText = s(b.rawText);
  // cvHtml is anchored to the candidate's own CV section, so prefer it whenever
  // it has real content — rawText can be dominated by the "similar profiles"
  // panel and mislead the extractor.
  const profileText = cvText.length > 200 ? cvText : rawText;

  // Extract fields with the same Haiku engine the resume parser uses. Prefer the
  // actual resume file (most accurate); fall back to / fill gaps from page text.
  const [aiFile, aiText] = await Promise.all([
    resumeBuf ? extractFromFile(resumeBuf, resumeName, resumeType) : Promise.resolve(null),
    profileText ? extractFromText(profileText) : Promise.resolve(null),
  ]);
  const ai: ParsedResume | null = mergeParsed(aiFile, aiText);

  // Decide what résumé file to store: the original download if the extension
  // captured one, otherwise the rendered CV HTML snapshot from the page (which
  // Resdex always shows), so a résumé document is attached either way.
  let storeBuf = resumeBuf;
  let storeName = resumeName;
  let storeType = resumeType;
  if (!storeBuf && cvHtml.length > 500) {
    storeBuf = Buffer.from(renderResumeDoc(s(b.name) || "Candidate", cvHtml), "utf8");
    storeName = "resume.html";
    storeType = "text/html";
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
