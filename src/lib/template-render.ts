// Single source of truth for rendering email/SMS templates.
//
// Substitutes every {{token}} from the provided vars map (case-insensitive).
// CRUCIALLY: any token NOT in the map is cleared to an empty string, so a raw
// {{placeholder}} can never be delivered to a candidate — the exact failure we
// had when a template used {{candidate_name}} / {{job_title}} / {{sender_name}}
// but the sender only knew {{name}}.
//
// Keep the advertised placeholder list (settings-modules.tsx) and the vars built
// by callers in sync; unknown-token clearing is the safety net if they drift.
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return (text || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const v = vars[key.toLowerCase()];
    return v !== undefined ? v : "";
  });
}
