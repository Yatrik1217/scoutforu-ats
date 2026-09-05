// Tiny allow-list sanitizer + helpers for the rich-text Job Description.
// The editor emits only presentational tags (styleWithCSS is turned off), so we
// keep a small tag allow-list and STRIP every attribute — no style/onclick/href
// can survive, which keeps the public careers page safe. Plain-text JDs saved
// before rich text are passed through unchanged (no tags to strip).

const ALLOWED = new Set([
  "b", "strong", "i", "em", "u", "p", "br", "ul", "ol", "li", "div", "span", "h3", "h4",
]);

export function sanitizeRichText(html: string): string {
  if (!html) return "";
  let s = html;
  // Drop dangerous elements together with their contents.
  s = s.replace(/<(script|style|iframe|object|embed|noscript|link|meta)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<(script|style|iframe|object|embed|noscript|link|meta)\b[^>]*\/?>/gi, "");
  // Keep only allow-listed tags, and strip ALL attributes from the ones we keep.
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?>/g, (_m, close: string, tag: string) => {
    const t = tag.toLowerCase();
    return ALLOWED.has(t) ? `<${close}${t}>` : "";
  });
  return s.trim();
}

// HTML → readable plain text (for list snippets and for the AI JD scorer).
export function stripHtml(html: string): string {
  return (html || "")
    .replace(/<(br|\/p|\/div|\/li|\/h3|\/h4)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// True when the string carries no HTML tags (an older plain-text JD).
export function looksPlainText(s: string): boolean {
  return !!s && !/<[a-z][\s\S]*>/i.test(s);
}

// Escape a plain-text JD and turn newlines into <br> so old records still show
// their line breaks once we render JDs as HTML.
export function plainToHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}
