import Anthropic from "@anthropic-ai/sdk";
import {
  GENDERS,
  MARITAL_STATUSES,
  QUALIFICATIONS,
  FUNCTIONAL_AREAS,
  INDUSTRIES,
} from "@/lib/domain";

// Shared Haiku-based candidate extractor. Used both by the resume-upload parser
// (PDF/DOCX) and by the Naukri Resdex import route (plain page text).

export type ParsedResume = {
  name: string;
  email: string;
  phone: string;
  altEmail: string;
  altPhone: string;
  location: string;
  expYears: number;
  currentDesignation: string;
  currentCompany: string;
  currentCtc: number;
  expectedCtc: number;
  noticePeriod: number;
  gender: string;
  graduation: string;
  postGraduation: string;
  function: string;
  industry: string;
  maritalStatus: string;
  birthDate: string;
  skills: string[];
};

export const SYSTEM = `You are a precise candidate-profile parser for an Indian recruitment ATS. Extract candidate details from the supplied resume or job-portal profile text and return ONLY a single JSON object — no prose, no markdown fences. Use empty string "" for unknown text fields, 0 for unknown numbers, and [] for skills if none found. CTC values are in ₹ Lakhs Per Annum (LPA) as numbers (e.g. 12.5); if a salary is given in ₹/month multiply by 12 and divide by 100000. Experience is total years as a number. Notice period is in days as a number. Birth date as YYYY-MM-DD or "".

email/phone MUST be the candidate's OWN personal contact. NEVER return a recruiter's, company's, job-portal's or support contact — e.g. ignore addresses like careers@, jobs@, hr@, support@, info@, noreply@, any address on a naukri.com / job-portal domain, and any phone labelled support/helpline/toll-free. If the candidate's own email or phone is not clearly present (e.g. masked/locked), return "".

For these fields, choose the closest value from the allowed list (or "" if none fits):
- gender: ${GENDERS.join(" | ")}
- maritalStatus: ${MARITAL_STATUSES.join(" | ")}
- graduation: ${QUALIFICATIONS.join(" | ")}
- postGraduation: ${QUALIFICATIONS.join(" | ")}
- function: ${FUNCTIONAL_AREAS.join(" | ")}
- industry: ${INDUSTRIES.join(" | ")}

JSON keys exactly: name, email, phone, altEmail, altPhone, location, expYears, currentDesignation, currentCompany, currentCtc, expectedCtc, noticePeriod, gender, graduation, postGraduation, function, industry, maritalStatus, birthDate, skills (array of short skill strings).`;

export function coerce(raw: Record<string, unknown>): ParsedResume {
  const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const n = (v: unknown) => {
    const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    return Number.isFinite(x) ? x : 0;
  };
  return {
    name: s(raw.name),
    email: s(raw.email),
    phone: s(raw.phone),
    altEmail: s(raw.altEmail),
    altPhone: s(raw.altPhone),
    location: s(raw.location),
    expYears: n(raw.expYears),
    currentDesignation: s(raw.currentDesignation),
    currentCompany: s(raw.currentCompany),
    currentCtc: n(raw.currentCtc),
    expectedCtc: n(raw.expectedCtc),
    noticePeriod: n(raw.noticePeriod),
    gender: s(raw.gender),
    graduation: s(raw.graduation),
    postGraduation: s(raw.postGraduation),
    function: s(raw.function),
    industry: s(raw.industry),
    maritalStatus: s(raw.maritalStatus),
    birthDate: s(raw.birthDate),
    skills: Array.isArray(raw.skills) ? raw.skills.map((x) => String(x)).slice(0, 20) : [],
  };
}

// Run Haiku over arbitrary user content (a document block or text) and coerce
// the JSON reply. Throws on API/parse failure so callers can decide fallback.
export async function extractFromContent(
  content: Anthropic.MessageParam["content"],
): Promise<ParsedResume> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  const textBlock = msg.content.find((b) => b.type === "text");
  const out = textBlock && "text" in textBlock ? textBlock.text : "";
  const jsonStr = out.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Parser returned no data.");
  return coerce(JSON.parse(jsonStr.slice(start, end + 1)));
}

// Extract candidate fields from plain profile text (Resdex page, pasted text …).
export async function extractFromText(text: string): Promise<ParsedResume | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const clean = (text || "").slice(0, 60000).trim();
  if (!clean) return null;
  try {
    return await extractFromContent([
      {
        type: "text",
        text: `Parse this candidate profile (copied from a job portal) into the JSON object.\n\nPROFILE:\n${clean}`,
      },
    ]);
  } catch {
    return null;
  }
}
