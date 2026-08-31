"use server";

import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { extractFromContent, type ParsedResume } from "@/lib/ai/extract";

// The content-hash storage path for a resume file. Identical files always land
// on the same path, which lets callers detect an exact re-upload *before* they
// spend an API call parsing it. Exported so the Talent Bank can pre-check.
export function resumeStoragePath(buf: Buffer, filename: string): string {
  const ext = (filename.split(".").pop() || "pdf").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "pdf";
  return `${createHash("sha256").update(buf).digest("hex")}.${ext.toLowerCase()}`;
}

export type { ParsedResume } from "@/lib/ai/extract";

type Result = {
  ok: boolean;
  data?: ParsedResume;
  resumeUrl?: string;
  error?: string;
  // A coarse machine code so the UI can react (e.g. halt a bulk dump and show a
  // "top up credits" banner) instead of just printing a raw error string.
  code?: "billing" | "auth" | "rate_limit" | "overloaded" | "config";
};

// Turn a raw Anthropic/SDK error into a plain-English message + a code the UI
// can branch on. The raw API error for an empty balance is an ugly
// `400 {"type":"error",..."credit balance is too low"...}` blob — never show
// that to a recruiter.
function classifyApiError(e: unknown): {
  code?: Result["code"];
  message: string;
} {
  const raw = e instanceof Error ? e.message : String(e);
  const status = (e as { status?: number })?.status;
  const lower = raw.toLowerCase();
  if (
    lower.includes("credit balance") ||
    lower.includes("purchase credits") ||
    lower.includes("plans & billing") ||
    lower.includes("billing")
  )
    return {
      code: "billing",
      message:
        "Anthropic API credits are exhausted — no resumes can be parsed until the balance is topped up. Add credits in the Anthropic Console → Plans & Billing, then re-run this dump.",
    };
  if (status === 401 || lower.includes("authentication") || lower.includes("x-api-key"))
    return {
      code: "auth",
      message: "The resume-parsing API key is invalid or revoked. Check the ANTHROPIC_API_KEY setting.",
    };
  if (status === 429 || lower.includes("rate limit"))
    return {
      code: "rate_limit",
      message: "Anthropic rate-limited the batch — wait a minute, then re-run the remaining resumes.",
    };
  if (status === 529 || lower.includes("overloaded"))
    return {
      code: "overloaded",
      message: "Anthropic is temporarily overloaded — retry in a moment.",
    };
  return { message: "Resume parsing failed. " + raw.slice(0, 160) };
}

export async function parseResume(formData: FormData): Promise<Result> {
  if (!process.env.ANTHROPIC_API_KEY)
    return { ok: false, error: "Resume parsing is not configured (missing API key).", code: "config" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file uploaded." };
  if (file.size > 8 * 1024 * 1024)
    return { ok: false, error: "File too large (max 8 MB)." };

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

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
    // Haiku is cost-effective (~0.4¢/resume) and strong at structured extraction.
    const parsed = await extractFromContent(content);

    // Store the original file so recruiters can view/download it later. If the
    // storage bucket/policies aren't set up yet, this is skipped silently.
    let resumeUrl = "";
    try {
      const supa = await createSupabase();
      // Name by content hash so an identical re-upload reuses the same object
      // (and can be detected as a duplicate before any parse).
      const path = resumeStoragePath(buf, name);
      const { error } = await supa.storage
        .from("resumes")
        .upload(path, buf, { contentType: file.type || undefined, upsert: true });
      if (!error) resumeUrl = path;
    } catch {
      /* storage optional */
    }

    return { ok: true, data: parsed, resumeUrl };
  } catch (e) {
    const { code, message } = classifyApiError(e);
    return { ok: false, error: message, code };
  }
}
