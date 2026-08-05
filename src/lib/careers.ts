// Agency-safe JD text: never expose the client's name on the public careers
// page. Replaces the client's company name (case-insensitive) with "our client"
// and tidies the common "the client, our client," redundancy.
export function maskClientName(text: string, clientName?: string | null): string {
  const name = (clientName || "").trim();
  if (!text) return "";
  if (!name || name.length < 2) return text;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = text.replace(new RegExp(`\\b${esc}\\b`, "gi"), "our client");
  out = out.replace(/\bthe\s+client[,]?\s+our client\b/gi, "our client");
  out = out.replace(/\bour client'?s?\s+our client\b/gi, "our client");
  return out;
}
