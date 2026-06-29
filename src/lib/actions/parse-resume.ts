"use server";

import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import {
  GENDERS,
  MARITAL_STATUSES,
  QUALIFICATIONS,
  FUNCTIONAL_AREAS,
  INDUSTRIES,
} from "@/lib/domain";

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

type Result = { ok: boolean; data?: ParsedResume; error?: string };

const SYSTEM = `You are a precise resume parser for an Indian recruitment ATS. Extract candidate details from the resume and return ONLY a single JSON object — no prose, no markdown fences. Use empty string "" for unknown text fields, 0 for unknown numbers, and [] for skills if none found. CTC values are in ₹ Lakhs Per Annum (LPA) as numbers (e.g. 12.5). Experience is total years as a number. Notice period is in days as a number. Birth date as YYYY-MM-DD or "".

For these fields, choose the closest value from the allowed list (or "" if none fits):
- gender: ${GENDERS.join(" | ")}
- maritalStatus: ${MARITAL_STATUSES.join(" | ")}
- graduation: ${QUALIFICATIONS.join(" | ")}
- postGraduation: ${QUALIFICATIONS.join(" | ")}
- function: ${FUNCTIONAL_AREAS.join(" | ")}
- industry: ${INDUSTRIES.join(" | ")}

JSON keys exactly: name, email, phone, altEmail, altPhone, location, expYears, currentDesignation, currentCompany, currentCtc, expectedCtc, noticePeriod, gender, graduation, postGraduation, function, industry, maritalStatus, birthDate, skills (array of short skill strings).`;

function coerce(raw: Record<string, unknown>): ParsedResume {
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

export async function parseResume(formData: FormData): Promise<Result> {
  if (!process.env.ANTHROPIC_API_KEY)
    return { ok: false, error: "Resume parsing is not configured (missing API key)." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file uploaded." };
  if (file.size > 8 * 1024 * 1024)
    return { ok: false, error: "File too large (max 8 MB)." };

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  const client = new Anthropic();

  // Build the user content: PDFs go straight to Claude as a document; other
  // formats are converted to text first.
  let content: Anthropic.MessageParam["content"];
  try {
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      content = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: buf.toString("base64"),
          },
        },
        { type: "text", text: "Parse this resume into the JSON object." },
      ];
    } else {
      let text = "";
      if (name.endsWith(".docx")) {
        text = (await mammoth.extractRawText({ buffer: buf })).value;
      } else {
        text = buf.toString("utf8");
      }
      text = text.slice(0, 60000).trim();
      if (!text) return { ok: false, error: "Could not read text from this file." };
      content = [{ type: "text", text: `Parse this resume into the JSON object.\n\nRESUME:\n${text}` }];
    }
  } catch {
    return { ok: false, error: "Could not read this file format. Use PDF or DOCX." };
  }

  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    const out = textBlock && "text" in textBlock ? textBlock.text : "";
    const json = out.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const start = json.indexOf("{");
    const end = json.lastIndexOf("}");
    if (start < 0 || end < 0) return { ok: false, error: "Parser returned no data." };
    const parsed = JSON.parse(json.slice(start, end + 1));
    return { ok: true, data: coerce(parsed) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Resume parsing failed.",
    };
  }
}
