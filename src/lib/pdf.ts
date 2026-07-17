import "server-only";
import { inflateSync, deflateSync } from "node:zlib";

// Minimal dependency-free PDF writer — enough for clean single/multi-page
// documents (text, lines, filled boxes, JPEG/PNG images) using the built-in
// Helvetica fonts. Works in any Node/serverless runtime; nothing to install.

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

type PdfImage = {
  data: Buffer;
  smask: Buffer | null; // 8-bit gray alpha channel, FlateDecode
  width: number;
  height: number;
  colorSpace: "DeviceRGB" | "DeviceGray";
  filter: "DCTDecode" | "FlateDecode";
};

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Decode an 8-bit non-interlaced PNG into raw RGB/Gray (+ alpha) buffers.
function decodePng(buf: Buffer): PdfImage | null {
  let pos = 8; // skip signature
  let w = 0,
    h = 0,
    bitDepth = 0,
    colorType = 0,
    interlace = 0;
  let plte: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === "PLTE") plte = Buffer.from(body);
    else if (type === "tRNS") trns = Buffer.from(body);
    else if (type === "IDAT") idat.push(Buffer.from(body));
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!w || !h || bitDepth !== 8 || interlace !== 0 || !idat.length) return null;
  const channels =
    colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 4;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const stride = w * channels;
  if (raw.length < h * (stride + 1)) return null;
  const px = Buffer.alloc(h * stride);
  let rp = 0;
  for (let row = 0; row < h; row++) {
    const filter = raw[rp++];
    const out = row * stride;
    const prev = out - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[rp + i];
      const left = i >= channels ? px[out + i - channels] : 0;
      const up = row > 0 ? px[prev + i] : 0;
      const ul = row > 0 && i >= channels ? px[prev + i - channels] : 0;
      let v = x;
      if (filter === 1) v = x + left;
      else if (filter === 2) v = x + up;
      else if (filter === 3) v = x + ((left + up) >> 1);
      else if (filter === 4) v = x + paeth(left, up, ul);
      px[out + i] = v & 0xff;
    }
    rp += stride;
  }

  const n = w * h;
  let rgb: Buffer;
  let alpha: Buffer | null = null;
  let colorSpace: "DeviceRGB" | "DeviceGray" = "DeviceRGB";
  if (colorType === 2) {
    rgb = px;
  } else if (colorType === 6) {
    rgb = Buffer.alloc(n * 3);
    alpha = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
      rgb[i * 3] = px[i * 4];
      rgb[i * 3 + 1] = px[i * 4 + 1];
      rgb[i * 3 + 2] = px[i * 4 + 2];
      alpha[i] = px[i * 4 + 3];
    }
  } else if (colorType === 0) {
    rgb = px;
    colorSpace = "DeviceGray";
  } else if (colorType === 4) {
    rgb = Buffer.alloc(n);
    alpha = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
      rgb[i] = px[i * 2];
      alpha[i] = px[i * 2 + 1];
    }
    colorSpace = "DeviceGray";
  } else if (colorType === 3 && plte) {
    rgb = Buffer.alloc(n * 3);
    if (trns) alpha = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
      const idx = px[i];
      rgb[i * 3] = plte[idx * 3];
      rgb[i * 3 + 1] = plte[idx * 3 + 1];
      rgb[i * 3 + 2] = plte[idx * 3 + 2];
      if (alpha) alpha[i] = trns && idx < trns.length ? trns[idx] : 255;
    }
  } else return null;

  return {
    data: deflateSync(rgb),
    smask: alpha ? deflateSync(alpha) : null,
    width: w,
    height: h,
    colorSpace,
    filter: "FlateDecode",
  };
}

// Read dimensions from a baseline/progressive JPEG.
function decodeJpeg(buf: Buffer): PdfImage | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let pos = 2;
  while (pos + 9 < buf.length) {
    if (buf[pos] !== 0xff) return null;
    const marker = buf[pos + 1];
    const len = buf.readUInt16BE(pos + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const comps = buf[pos + 9];
      if (comps !== 1 && comps !== 3) return null; // no CMYK
      return {
        data: buf,
        smask: null,
        width: buf.readUInt16BE(pos + 7),
        height: buf.readUInt16BE(pos + 5),
        colorSpace: comps === 1 ? "DeviceGray" : "DeviceRGB",
        filter: "DCTDecode",
      };
    }
    pos += 2 + len;
  }
  return null;
}

export class Pdf {
  private pages: string[][] = [[]];
  private images: PdfImage[] = [];

  private get buf(): string[] {
    return this.pages[this.pages.length - 1];
  }

  // Register an image (JPEG or 8-bit non-interlaced PNG). Returns a handle for
  // drawImage, or null if the format isn't supported.
  addImage(bytes: Buffer): { idx: number; width: number; height: number } | null {
    const img =
      bytes[0] === 0x89 && bytes[1] === 0x50 ? decodePng(bytes) : decodeJpeg(bytes);
    if (!img) return null;
    this.images.push(img);
    return { idx: this.images.length - 1, width: img.width, height: img.height };
  }

  // Draw a registered image; (x, y) is the top-left corner on the page.
  drawImage(idx: number, x: number, y: number, w: number, h: number) {
    this.buf.push(
      `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(A4.h - y - h).toFixed(2)} cm /Im${idx} Do Q`,
    );
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
    // 1: catalog, 2: pages, 3..5: fonts, then images (+ soft masks), then per
    // page: page obj + content obj.
    const imageIds: number[] = [];
    let nextId = 6;
    for (const img of this.images) {
      imageIds.push(nextId);
      nextId += img.smask ? 2 : 1;
    }
    const firstPageId = nextId;
    const pageIds = Array.from({ length: n }, (_, i) => firstPageId + i * 2);

    objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
    objects.push(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${n} >>`,
    );
    for (const f of ["regular", "bold", "italic"] as FontKey[])
      objects.push(
        `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAME[f]} /Encoding /WinAnsiEncoding >>`,
      );
    this.images.forEach((img, i) => {
      const smaskRef = img.smask ? ` /SMask ${imageIds[i] + 1} 0 R` : "";
      objects.push(
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} ` +
          `/ColorSpace /${img.colorSpace} /BitsPerComponent 8 /Filter /${img.filter}${smaskRef} ` +
          `/Length ${img.data.length} >>\nstream\n${img.data.toString("latin1")}\nendstream`,
      );
      if (img.smask)
        objects.push(
          `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} ` +
            `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode ` +
            `/Length ${img.smask.length} >>\nstream\n${img.smask.toString("latin1")}\nendstream`,
        );
    });
    const xobjects = this.images.length
      ? ` /XObject << ${this.images.map((_, i) => `/Im${i} ${imageIds[i]} 0 R`).join(" ")} >>`
      : "";
    for (let i = 0; i < n; i++) {
      const contentId = firstPageId + i * 2 + 1;
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xobjects} >> /Contents ${contentId} 0 R >>`,
      );
      const stream = this.pages[i].join("\n");
      objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    }

    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((obj, i) => {
      offsets.push(Buffer.byteLength(out, "latin1"));
      out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, "latin1");
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(out, "latin1");
  }
}
