import "server-only";

// Minimal dependency-free PDF writer — enough for clean single/multi-page
// documents (text, lines, filled boxes) using the built-in Helvetica fonts.
// Works in any Node/serverless runtime; nothing to install or bundle.

export type FontKey = "regular" | "bold" | "italic";

// Helvetica / Helvetica-Bold glyph widths (per 1000 units) for chars 32..126.
// prettier-ignore
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
// prettier-ignore
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const FONT_NAME: Record<FontKey, string> = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
};

// Replace characters outside WinAnsi/ASCII with safe equivalents.
export function pdfSafe(s: string): string {
  return (s || "")
    .replace(/₹/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7e\n]/g, "");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export const A4 = { w: 595.28, h: 841.89 };

type TextOpts = {
  size?: number;
  font?: FontKey;
  color?: string; // hex
  align?: "left" | "right" | "center";
};

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export class Pdf {
  private pages: string[][] = [[]];

  private get buf(): string[] {
    return this.pages[this.pages.length - 1];
  }

  addPage() {
    this.pages.push([]);
  }

  get pageCount(): number {
    return this.pages.length;
  }

  textWidth(s: string, size: number, font: FontKey = "regular"): number {
    const table = font === "bold" ? W_BOLD : W_REG;
    let w = 0;
    for (const ch of pdfSafe(s)) {
      const c = ch.charCodeAt(0);
      w += c >= 32 && c <= 126 ? table[c - 32] : 556;
    }
    return (w / 1000) * size;
  }

  // (x, y) is the TOP-LEFT-origin baseline position.
  text(s: string, x: number, y: number, o: TextOpts = {}) {
    const size = o.size ?? 10;
    const font = o.font ?? "regular";
    const str = pdfSafe(s);
    if (!str) return;
    let tx = x;
    if (o.align === "right") tx = x - this.textWidth(str, size, font);
    else if (o.align === "center") tx = x - this.textWidth(str, size, font) / 2;
    const [r, g, b] = hexRgb(o.color ?? "#16203a");
    const fontId = font === "bold" ? "F2" : font === "italic" ? "F3" : "F1";
    this.buf.push(
      `BT /${fontId} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ` +
        `${tx.toFixed(2)} ${(A4.h - y).toFixed(2)} Td (${esc(str)}) Tj ET`,
    );
  }

  // Wrap text into lines that fit maxWidth; returns the y after the block.
  textBlock(
    s: string,
    x: number,
    y: number,
    maxWidth: number,
    o: TextOpts & { lineHeight?: number } = {},
  ): number {
    const size = o.size ?? 10;
    const lh = o.lineHeight ?? size * 1.45;
    let cy = y;
    for (const para of pdfSafe(s).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const probe = line ? line + " " + word : word;
        if (this.textWidth(probe, size, o.font) > maxWidth && line) {
          this.text(line, x, cy, o);
          cy += lh;
          line = word;
        } else line = probe;
      }
      this.text(line, x, cy, o);
      cy += lh;
    }
    return cy;
  }

  line(x1: number, y1: number, x2: number, y2: number, color = "#e3e8f0", width = 1) {
    const [r, g, b] = hexRgb(color);
    this.buf.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${width} w ` +
        `${x1.toFixed(2)} ${(A4.h - y1).toFixed(2)} m ${x2.toFixed(2)} ${(A4.h - y2).toFixed(2)} l S`,
    );
  }

  // Filled rectangle; (x, y) is the top-left corner.
  rect(x: number, y: number, w: number, h: number, fill: string) {
    const [r, g, b] = hexRgb(fill);
    this.buf.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ` +
        `${x.toFixed(2)} ${(A4.h - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`,
    );
  }

  render(): Buffer {
    const objects: string[] = [];
    const n = this.pages.length;
    // 1: catalog, 2: pages, 3..5: fonts, then per page: page obj + content obj.
    objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
    const pageIds = Array.from({ length: n }, (_, i) => 6 + i * 2);
    objects.push(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${n} >>`,
    );
    for (const f of ["regular", "bold", "italic"] as FontKey[])
      objects.push(
        `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAME[f]} /Encoding /WinAnsiEncoding >>`,
      );
    for (let i = 0; i < n; i++) {
      const contentId = 7 + i * 2;
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`,
      );
      const stream = this.pages[i].join("\n");
      objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    }

    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((obj, i) => {
      offsets.push(Buffer.byteLength(out));
      out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out);
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(out, "latin1");
  }
}
