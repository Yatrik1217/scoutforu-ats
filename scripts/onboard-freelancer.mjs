// ScoutforU ATS — onboard a freelance recruiter AFTER their login exists.
//
// Usage (from the repo root, where .env.local lives):
//   node scripts/onboard-freelancer.mjs <email> [--lead <jobId>]... [--co <jobId>]...
//
// 1. Create the login first in the app (Team → Add user, role Recruiter).
// 2. This then links a "contract" employee record to it — that is what limits
//    the login to the Workspace menu + My Attendance and lets them punch in —
//    and assigns the given roles (--lead = make them the lead, --co = add as
//    co-recruiter; existing recruiters and candidates are left untouched).
// Safe to re-run.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(repoRoot, ".env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const api = async (path, init = {}) => {
  const r = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const text = await r.text();
  if (!r.ok) { console.error(`✗ ${path}: ${r.status} ${text}`); process.exit(1); }
  return text ? JSON.parse(text) : null;
};

const [email, ...rest] = process.argv.slice(2);
const lead = [], co = [];
for (let i = 0; i < rest.length; i += 2) {
  if (rest[i] === "--lead") lead.push(rest[i + 1]);
  else if (rest[i] === "--co") co.push(rest[i + 1]);
}
if (!email) { console.error("Usage: node scripts/onboard-freelancer.mjs <email> [--lead <jobId>]... [--co <jobId>]..."); process.exit(1); }

const [profile] = await api(`profiles?select=id,name,email,role&email=eq.${encodeURIComponent(email.toLowerCase())}`);
if (!profile) { console.error(`✗ No login for ${email} yet — add it in the app first (Team → Add user, role Recruiter).`); process.exit(1); }
if (profile.role !== "recruiter") { console.error(`✗ ${email} is a ${profile.role}, not a recruiter.`); process.exit(1); }

// Freelancers sit outside the in-house incentive plan.
await api(`profiles?id=eq.${profile.id}`, { method: "PATCH", body: JSON.stringify({ incentive_percent: 0 }) });

const [existing] = await api(`employees?select=id,employee_code,employment_type&profile_id=eq.${profile.id}`);
if (existing) {
  if (existing.employment_type !== "contract")
    await api(`employees?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify({ employment_type: "contract" }) });
  console.log(`✓ Employee record ${existing.employee_code} already linked (type: contract)`);
} else {
  const codes = await api("employees?select=employee_code");
  // Consultants get their own series — they are not SFU-numbered staff.
  const next = Math.max(0, ...codes.map((c) => Number(/^Consultant-(\d+)$/.exec(c.employee_code)?.[1] ?? 0))) + 1;
  const code = `Consultant-${String(next).padStart(3, "0")}`;
  await api("employees", {
    method: "POST",
    body: JSON.stringify({
      profile_id: profile.id,
      employee_code: code,
      name: profile.name,
      email: profile.email,
      designation: "Consultant Recruiter",
      department: "Recruitment",
      employment_type: "contract",
      joined_on: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
      probation_months: 0,
      monthly_gross: 0,
      notes: "Freelancer — paid outside payroll.",
    }),
  });
  console.log(`✓ Employee record ${code} created (contract, no salary) and linked to ${profile.name}`);
}

for (const jobId of [...lead, ...co]) {
  const [job] = await api(`jobs?select=id,title&id=eq.${jobId}`);
  if (!job) { console.error(`✗ No job ${jobId}`); process.exit(1); }
  await api("job_recruiters?on_conflict=job_id,recruiter_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ job_id: jobId, recruiter_id: profile.id }),
  });
  if (lead.includes(jobId))
    await api(`jobs?id=eq.${jobId}`, { method: "PATCH", body: JSON.stringify({ recruiter_id: profile.id }) });
  console.log(`✓ ${job.title} — ${lead.includes(jobId) ? "lead" : "co-recruiter"}`);
}
