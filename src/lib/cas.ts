import "server-only";

// Read a password-protected Consolidated Account Statement (CAS from
// CAMS / KFintech / MFCentral). The PDF is encrypted, so we decrypt it with the
// user's password via pdf.js (legacy build runs in Node) and pull out the text;
// a language model then extracts the holdings from that text.

// pdf.js legacy build runs on the main thread in Node (no web worker).
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs;
}

export class CasPasswordError extends Error {}

export async function extractCasText(buf: Buffer, password: string): Promise<string> {
  const pdfjs = await loadPdfjs();
  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buf),
      password: password || undefined,
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
    }).promise;
  } catch (e: unknown) {
    const err = e as { name?: string; code?: number };
    // PasswordException: code 1 = needs password, 2 = incorrect password.
    if (err?.name === "PasswordException" || err?.code === 1 || err?.code === 2) {
      throw new CasPasswordError("bad-password");
    }
    throw e;
  }
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ") + "\n";
  }
  await doc.destroy();
  return text;
}

export type AmfiFund = { code: string; name: string; nav: number; date: string };

// ISIN -> AMFI scheme (code + latest NAV), from AMFI's official daily file.
// A CAS lists each holding's ISIN, which we map to the AMFI scheme code so the
// imported fund tracks live NAV exactly like a manually-added SIP.
export async function amfiIsinMap(): Promise<Map<string, AmfiFund>> {
  const map = new Map<string, AmfiFund>();
  try {
    const res = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", {
      next: { revalidate: 3600, tags: ["navs"] },
    });
    if (!res.ok) return map;
    const text = await res.text();
    for (const line of text.split("\n")) {
      const f = line.split(";");
      if (f.length < 6) continue;
      const code = f[0].trim();
      if (!/^\d+$/.test(code)) continue; // skip headers / section titles
      const nav = parseFloat(f[f.length - 2]);
      const fund: AmfiFund = {
        code,
        name: f[3].trim(),
        nav: Number.isFinite(nav) ? nav : 0,
        date: f[f.length - 1].trim(),
      };
      for (const isin of [f[1].trim(), f[2].trim()]) {
        if (isin && isin !== "-") map.set(isin.toUpperCase(), fund);
      }
    }
  } catch {
    /* AMFI unreachable — holdings still import, just without a live match */
  }
  return map;
}
