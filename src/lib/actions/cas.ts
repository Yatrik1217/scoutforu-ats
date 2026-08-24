"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/invoice";
import { extractCasText, amfiIsinMap, CasPasswordError } from "@/lib/cas";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { sb, ok: false as const };
  const { data: me } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { sb, ok: me?.role === "master_admin" };
}

// One holding parsed from the CAS, joined to its live AMFI fund.
export type CasHolding = {
  scheme: string;
  isin: string;
  folio: string;
  units: number;
  cost: number; // invested / cost value from the statement
  matchedCode: string | null; // AMFI scheme code (null = couldn't match to AMFI)
  matchedName: string;
  nav: number;
  liveValue: number; // units × live NAV
};

const CAS_SYSTEM = `You extract mutual-fund holdings from an Indian Consolidated Account Statement (CAS) — from CAMS, KFintech, or MFCentral. Return ONLY a JSON array, no prose, no markdown fences.

For EVERY scheme/folio that has a non-zero CLOSING unit balance, output one object:
{"scheme": "<full scheme name>", "isin": "<ISIN like INF...>", "folio": "<folio number>", "units": <closing unit balance as a plain number>, "cost": <total cost value / amount invested, as a plain number in rupees>}

Rules:
- Use the CLOSING unit balance, never a single transaction's units.
- cost = the total cost value / invested amount for that holding (NOT the market/current value). If cost isn't shown, use 0.
- Skip any scheme whose closing balance is 0.
- Numbers must be plain: no commas, no ₹, no "INR".
- The ISIN is essential — include it exactly as printed.
Return [] if there are no holdings.`;

export async function previewCas(formData: FormData): Promise<Result<CasHolding[]>> {
  const { ok } = await requireAdmin();
  if (!ok) return { ok: false, error: "Only the Master Admin can manage Finance." };
  if (!process.env.ANTHROPIC_API_KEY)
    return { ok: false, error: "Statement parsing isn't configured (missing API key)." };

  const file = formData.get("file");
  const password = String(formData.get("password") || "");
  if (!(file instanceof File)) return { ok: false, error: "Upload your CAS PDF." };
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "File too large (max 15 MB)." };

  const buf = Buffer.from(await file.arrayBuffer());
  let text = "";
  try {
    text = await extractCasText(buf, password);
  } catch (e) {
    if (e instanceof CasPasswordError)
      return {
        ok: false,
        error:
          "Wrong or missing password. A CAS is password-protected — enter the password you set when generating it (often your PAN in CAPS).",
      };
    return {
      ok: false,
      error: "Couldn't read this PDF. Make sure it's your CAMS / KFintech / MFCentral CAS.",
    };
  }
  if (!text || text.replace(/\s/g, "").length < 200)
    return { ok: false, error: "No readable holdings text found in this PDF." };

  let arr: unknown;
  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: CAS_SYSTEM,
      messages: [{ role: "user", content: `CAS statement text:\n\n${text.slice(0, 120000)}` }],
    });
    const tb = msg.content.find((b) => b.type === "text");
    let raw = tb && "text" in tb ? tb.text : "";
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const s = raw.indexOf("[");
    const en = raw.lastIndexOf("]");
    arr = JSON.parse(raw.slice(s, en + 1));
  } catch {
    return { ok: false, error: "Couldn't read the holdings from this statement." };
  }
  if (!Array.isArray(arr) || arr.length === 0)
    return { ok: false, error: "No holdings found in this statement." };

  const isinMap = await amfiIsinMap();
  const holdings: CasHolding[] = arr
    .map((h) => h as Record<string, unknown>)
    .filter((h) => Number(h.units) > 0)
    .map((h) => {
      const isin = String(h.isin || "").trim().toUpperCase();
      const fund = isinMap.get(isin) || null;
      const units = Number(h.units) || 0;
      const nav = fund?.nav || 0;
      return {
        scheme: String(h.scheme || ""),
        isin,
        folio: String(h.folio || ""),
        units,
        cost: Number(h.cost) || 0,
        matchedCode: fund?.code || null,
        matchedName: fund?.name || "",
        nav,
        liveValue: nav ? units * nav : 0,
      };
    });

  return { ok: true, data: holdings };
}

// Write the confirmed holdings into the SIP/investment list. Matches an existing
// investment by AMFI scheme code (updates its units + cost) or creates a new one,
// so re-importing a fresh CAS just refreshes the numbers.
export async function importCas(
  holdings: CasHolding[],
): Promise<Result<{ imported: number; updated: number }>> {
  const { sb, ok } = await requireAdmin();
  if (!ok) return { ok: false, error: "Only the Master Admin can manage Finance." };

  let imported = 0;
  let updated = 0;
  for (const h of holdings) {
    if (!h.matchedCode || !(h.units > 0)) continue; // only import funds matched to a live AMFI code
    const units = round2(h.units);
    const principal = round2(h.cost);
    const current_value = round2(h.liveValue);
    const { data: existing } = await sb
      .from("finance_emis")
      .select("id")
      .eq("type", "sip")
      .eq("scheme_code", h.matchedCode)
      .maybeSingle();
    if (existing) {
      const { error } = await sb
        .from("finance_emis")
        .update({ units, principal, current_value, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (!error) updated++;
    } else {
      const { error } = await sb.from("finance_emis").insert({
        scope: "personal",
        type: "sip",
        name: h.matchedName || h.scheme || "Mutual fund",
        lender: "",
        category_id: null,
        principal,
        current_value,
        scheme_code: h.matchedCode,
        units,
        emi_amount: 0,
        interest_rate: 0,
        total_installments: 0,
        paid_installments: 0,
        start_date: new Date().toISOString().slice(0, 10),
        due_day: 1,
        status: "active",
        notes: "Imported from CAS",
        updated_at: new Date().toISOString(),
      });
      if (!error) imported++;
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { imported, updated } };
}
