import { STALL_DAYS, type RecruiterMetric } from "@/lib/team-metrics";

// HTML for the daily recruiting summary email. Table-based with inline styles so
// it renders consistently across mail clients (Gmail, Outlook, Apple Mail).

const INK = "#16203a";
const MUTE = "#8a94a6";
const BLUE = "#2a6fdb";
const GREEN = "#16a34a";
const PURPLE = "#8b5cf6";
const AMBER = "#d9730d";
const RED = "#dc2626";
const LINE = "#e9edf3";
const SOFT = "#f7f9fc";

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

// One stat: big value over a small caption. Used inside a row of <td>s.
function statCell(value: string | number, label: string, color = INK): string {
  return `<td align="center" width="25%" style="padding:6px 4px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;line-height:1;color:${color};">${value}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;color:${MUTE};text-transform:uppercase;letter-spacing:.5px;padding-top:5px;">${esc(label)}</div>
  </td>`;
}

// A labelled band of stats (caption on the left, a row of stat cells).
function band(caption: string, cells: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:10px;margin-top:10px;">
    <tr><td style="padding:9px 14px 2px;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;font-weight:800;color:#9aa4b6;text-transform:uppercase;letter-spacing:.6px;">${esc(caption)}</td></tr>
    <tr><td style="padding:0 8px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells.join("")}</tr></table></td></tr>
  </table>`;
}

function openingRow(o: RecruiterMetric["openings"][number]): string {
  const sub = esc([o.clientName, o.dept].filter(Boolean).join(" · ") || "—");
  const stall = o.stalled
    ? `<span style="display:inline-block;background:#fdecec;color:${RED};font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;margin-left:6px;">&#9888; ${o.stalled} stalled</span>`
    : "";
  return `<tr>
    <td style="padding:9px 0;border-top:1px solid #f0f3f8;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:13px;font-weight:700;color:${INK};">${esc(o.title)}${stall}</div>
      <div style="font-size:11px;font-weight:600;color:${MUTE};padding-top:2px;">${sub}</div>
    </td>
    <td align="right" valign="middle" style="padding:9px 0;border-top:1px solid #f0f3f8;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">
      <span style="font-size:18px;font-weight:800;color:${BLUE};">${o.active}</span>
      <span style="font-size:10px;font-weight:700;color:${MUTE};"> cand.</span>
    </td>
  </tr>`;
}

function recruiterCard(m: RecruiterMetric): string {
  const stalledBadge = m.stalled
    ? `<span style="display:inline-block;background:#fdecec;color:${RED};font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;">&#9888; ${m.stalled} stalled</span>`
    : `<span style="display:inline-block;background:#e9f9ef;color:${GREEN};font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;">On track</span>`;

  const shown = m.openings.slice(0, 6);
  const openings = shown.length
    ? shown.map(openingRow).join("")
    : `<tr><td style="padding:10px 0;border-top:1px solid #f0f3f8;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:${MUTE};">No active candidates right now.</td></tr>`;
  const more =
    m.openings.length > shown.length
      ? `<tr><td colspan="2" style="padding:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#9aa4b6;">+ ${m.openings.length - shown.length} more opening${m.openings.length - shown.length === 1 ? "" : "s"} — see the ATS</td></tr>`
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:14px;margin:0 0 16px;background:#ffffff;">
    <tr><td style="padding:16px 18px;">

      <!-- header -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="42" valign="middle" style="width:42px;">
          <div style="width:40px;height:40px;border-radius:50%;background:${BLUE};color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;text-align:center;line-height:40px;">${esc(initials(m.name))}</div>
        </td>
        <td valign="middle" style="padding-left:12px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;color:${INK};">${esc(m.name)}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:${MUTE};">Recruiter · ${m.openings.length} opening${m.openings.length === 1 ? "" : "s"}</div>
        </td>
        <td align="right" valign="middle">${stalledBadge}</td>
      </tr></table>

      ${band("Pipeline", [
        statCell(m.active, "Active", BLUE),
        statCell(m.openings.length, "Openings", INK),
        statCell(m.interviewing, "Interviewing", PURPLE),
        statCell(m.hires, "Hires", GREEN),
      ])}

      ${band("This week (last 7 days)", [
        statCell(m.week.submitted, "Submitted", INK),
        statCell(m.week.interviews, "Interviews", INK),
        statCell(m.week.offers, "Offers", INK),
        statCell(m.week.hires, "Hires", GREEN),
      ])}

      ${band(`Conversion · ${m.conv.handled} handled`, [
        statCell(m.conv.interviewPct + "%", "To interview", PURPLE),
        statCell(m.conv.offerPct + "%", "To offer", AMBER),
        statCell(m.conv.hirePct + "%", "To hire", GREEN),
      ])}

      <!-- openings -->
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10.5px;font-weight:800;color:#9aa4b6;text-transform:uppercase;letter-spacing:.6px;padding:16px 0 2px;">Openings worked (by submission)</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${openings}${more}</table>

    </td></tr>
  </table>`;
}

export function renderDigest(metrics: RecruiterMetric[], asOf: string): string {
  const totalActive = metrics.reduce((n, m) => n + m.active, 0);
  const totalStalled = metrics.reduce((n, m) => n + m.stalled, 0);
  const totalWeekSub = metrics.reduce((n, m) => n + m.week.submitted, 0);

  const pill = (label: string, value: string | number, color: string) =>
    `<td style="padding:0 6px;"><div style="background:#ffffff;border:1px solid rgba(255,255,255,.6);border-radius:10px;padding:8px 14px;font-family:Arial,Helvetica,sans-serif;text-align:center;">
      <span style="font-size:17px;font-weight:800;color:${color};">${value}</span>
      <span style="font-size:11px;font-weight:700;color:${MUTE};"> ${esc(label)}</span>
    </div></td>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#eef1f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;"><tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">

        <!-- brand header -->
        <tr><td style="background:${INK};border-radius:16px 16px 0 0;padding:20px 22px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#ffffff;">Daily Recruiting Summary</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#aeb9d0;padding-top:3px;">${esc(asOf)}</div>
        </td></tr>

        <!-- totals -->
        <tr><td style="background:#f2f5fb;padding:14px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
            ${pill("active", totalActive, BLUE)}
            ${pill("stalled", totalStalled, totalStalled ? RED : GREEN)}
            ${pill("new this week", totalWeekSub, INK)}
            ${pill("recruiters", metrics.length, INK)}
          </tr></table>
        </td></tr>

        <!-- cards -->
        <tr><td style="background:#eef1f6;padding:16px 0 4px;">
          ${metrics.map(recruiterCard).join("")}
        </td></tr>

        <!-- footer -->
        <tr><td style="padding:4px 8px 8px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#aab2c0;line-height:1.5;">
            “Stalled” = active candidates sitting in one stage more than ${STALL_DAYS} days. Conversion is measured over everyone each recruiter has handled: “to interview” counts every candidate moved to the client-interview stage or beyond (not just ATS-scheduled interviews). Openings are credited to whoever submitted the candidate, so a shared role appears for each contributor. Open <b>ATS → Recruiting Team</b> for the interactive view.
          </div>
        </td></tr>

      </table>
    </td></tr></table>
  </body></html>`;
}
