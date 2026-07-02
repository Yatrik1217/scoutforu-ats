"use server";

import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { extractFromContent, type ParsedResume } from "@/lib/ai/extract";

export type { ParsedResume } from "@/lib/ai/extract";

type Result = {
  ok: boolean;
  data?: ParsedResume;
  resumeUrl?: string;
  error?: string;
};

export async function parseResume(formData: FormData): Promise<Result> {
  if (!process.env.ANTHROPIC_API_KEY)
    return { ok: false, error: "Resume parsing is not configured (missing API key)." };

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
      const ext = (name.split(".").pop() || "pdf").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "pdf";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supa.storage
        .from("resumes")
        .upload(path, buf, { contentType: file.type || undefined });
      if (!error) resumeUrl = path;
    } catch {
      /* storage optional */
    }

    return { ok: true, data: parsed, resumeUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Resume parsing failed.",
    };
  }
}
