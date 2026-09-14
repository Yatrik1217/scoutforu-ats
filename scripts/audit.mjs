// ScoutforU ATS — data-integrity + dashboard-reconciliation audit (READ-ONLY).
//
// Usage (from the repo root, where .env.local lives):
//   node scripts/audit.mjs
//
// It never writes anything — it reads the live database with the service-role
// key from .env.local and prints: stage integrity, orphaned/duplicate records,
// per-recruiter workload, Talent Pool, job gaps, and reconciles every dashboard
// number. Run it whenever a screen's number looks wrong.
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
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const get = (p) => fetch(`${URL}/rest/v1/${p}`, { headers: H }).then((r) => r.json());

const line = (s = "") => console.log(s);
const hdr = (s) => { line(); line("━━━ " + s + " ━━━"); };
const flag = (cond, msg) => line((cond ? "  ⚠️  " : "  ✓  ") + msg);

const [stagesRaw, cands, jobs, profs, interviews, offers] = await Promise.all([
  get("pipeline_stages?select=*&order=position&limit=5000"),
  get("candidates?select=id,name,stage,job_id,recruiter_id,on_hold,source,email,phone,alt_email,alt_phone,entered_stage_at,created_at,review_status&limit=5000"),
  get("jobs?select=id,title,status,client_id,recruiter_id,target_date&limit=5000"),
  get("profiles?select=id,name,role,active&limit=5000"),
  get("interviews?select=id,candidate_id&limit=5000"),
  get("offers?select=id,candidate_id&limit=5000"),
]);

const RE_INTV = /interview|technical|practical|round|managerial/i;
const def = stagesRaw.filter((s) => s.client_id === null).sort((a, b) => a.position - b.position);
const meta = Object.fromEntries(def.map((s) => [s.slug, s]));
const isIntv = (slug) => meta[slug] && meta[slug].outcome === "in_progress" && RE_INTV.test(meta[slug].slug + " " + meta[slug].name);
const submitPos = meta["client_submit"]?.position ?? meta["screening"]?.position ?? 2;
const jobById = Object.fromEntries(jobs.map((j) => [j.id, j]));
const profById = Object.fromEntries(profs.map((p) => [p.id, p]));
const candIds = new Set(cands.map((c) => c.id));

line("SCOUTFORU ATS — FULL DATA AUDIT");
line("Run: " + new Date().toISOString());
line(`Totals: ${cands.length} candidates · ${jobs.length} jobs · ${profs.length} staff · ${def.length} pipeline stages`);

hdr("1. Stage integrity");
const unknownStage = cands.filter((c) => !meta[c.stage]);
flag(unknownStage.length, `${unknownStage.length} candidate(s) with a stage NOT in the pipeline (would misclassify)`);
unknownStage.slice(0, 20).forEach((c) => line(`       - ${c.name}: stage="${c.stage}"`));
const byStage = {};
for (const c of cands) byStage[c.stage] = (byStage[c.stage] ?? 0) + 1;
line("  Stage distribution:");
for (const s of def) if (byStage[s.slug]) line(`       ${s.name} [${s.slug}] — ${byStage[s.slug]} (${s.outcome})`);

hdr("2. Orphaned & unassigned records");
const badJobRef = cands.filter((c) => c.job_id && !jobById[c.job_id]);
flag(badJobRef.length, `${badJobRef.length} candidate(s) point to a job that no longer exists`);
const inProg = cands.filter((c) => meta[c.stage]?.outcome === "in_progress" && !c.on_hold);
flag(inProg.filter((c) => !c.job_id).length, `${inProg.filter((c) => !c.job_id).length} ACTIVE candidate(s) with no job attached`);
flag(inProg.filter((c) => !c.recruiter_id || !profById[c.recruiter_id]).length, `${inProg.filter((c) => !c.recruiter_id || !profById[c.recruiter_id]).length} ACTIVE candidate(s) with no valid recruiter owner`);
flag(interviews.filter((i) => !candIds.has(i.candidate_id)).length, `${interviews.filter((i) => !candIds.has(i.candidate_id)).length} interview row(s) referencing a missing candidate`);
flag(offers.filter((o) => !candIds.has(o.candidate_id)).length, `${offers.filter((o) => !candIds.has(o.candidate_id)).length} offer row(s) referencing a missing candidate`);

hdr("3. Dashboard numbers");
const held = cands.filter((c) => c.on_hold);
const hires = cands.filter((c) => meta[c.stage]?.outcome === "won").length;
const lost = cands.filter((c) => meta[c.stage]?.outcome === "lost").length;
line(`  Open Jobs (status != closed) ....... ${jobs.filter((j) => j.status !== "closed").length}  (of ${jobs.length})`);
line(`  Active (in-progress, !hold) ........ ${inProg.length}`);
line(`  In Interview ....................... ${cands.filter((c) => isIntv(c.stage) && !c.on_hold).length}`);
line(`  Offers Out (stage=offered) ......... ${cands.filter((c) => c.stage === "offered" && !c.on_hold).length}`);
line(`  Hires (won) ........................ ${hires}`);
line(`  On hold ............................ ${held.length}`);
line(`  Lost/Rejected ...................... ${lost}`);

hdr("4. Per-recruiter workload");
const now = Date.now();
for (const r of profs.filter((p) => p.role === "recruiter")) {
  const owned = cands.filter((c) => c.recruiter_id === r.id);
  const mine = owned.filter((c) => meta[c.stage]?.outcome === "in_progress" && !c.on_hold);
  const stalled = mine.filter((c) => (now - +new Date(c.entered_stage_at)) / 86400000 > 10).length;
  line(`  ${r.name} (${r.active ? "active" : "INACTIVE"}): ${mine.length} active · ${mine.filter((c) => isIntv(c.stage)).length} interviewing · ${stalled} stalled · ${new Set(mine.map((c) => c.job_id).filter(Boolean)).size} openings · ${owned.filter((c) => meta[c.stage]?.outcome === "won").length} hires`);
}

hdr("5. Talent Pool (pre-submission bench)");
const bench = inProg.filter((c) => (meta[c.stage]?.position ?? 99) < submitPos);
line(`  ${bench.length} candidate(s) before Client Submit:`);
bench.slice(0, 30).forEach((c) => line(`       - ${c.name} [${meta[c.stage]?.name}] via ${c.source ?? "—"}`));

hdr("6. Jobs / openings");
const openJobs = jobs.filter((j) => j.status !== "closed");
const candByJob = {};
for (const c of inProg) if (c.job_id) candByJob[c.job_id] = (candByJob[c.job_id] ?? 0) + 1;
const emptyOpen = openJobs.filter((j) => !candByJob[j.id]);
flag(emptyOpen.length, `${emptyOpen.length} open job(s) with ZERO active candidates:`);
emptyOpen.slice(0, 30).forEach((j) => line(`       - ${j.title}${j.recruiter_id ? " · " + (profById[j.recruiter_id]?.name ?? "?") : " · no recruiter"}`));
const today = new Date().toISOString().slice(0, 10);
const overdue = openJobs.filter((j) => j.target_date && j.target_date < today);
flag(overdue.length, `${overdue.length} open job(s) past their target date:`);
overdue.slice(0, 20).forEach((j) => line(`       - ${j.title} (target ${j.target_date})`));

hdr("7. Duplicate candidates (distinct records sharing email/phone)");
const em = {}, ph = {}, norm = (p) => (p || "").replace(/\D/g, "").slice(-10);
for (const c of cands) {
  for (const e of new Set([c.email, c.alt_email].filter(Boolean).map((e) => e.trim().toLowerCase()))) (em[e] ??= new Set()).add(c.name);
  for (const n of new Set([c.phone, c.alt_phone].filter(Boolean).map(norm).filter((n) => n.length >= 7))) (ph[n] ??= new Set()).add(c.name);
}
const dupE = Object.entries(em).filter(([, v]) => v.size > 1), dupP = Object.entries(ph).filter(([, v]) => v.size > 1);
flag(dupE.length, `${dupE.length} email(s) shared by different candidates`);
dupE.slice(0, 15).forEach(([e, v]) => line(`       - ${e}: ${[...v].join(" + ")}`));
flag(dupP.length, `${dupP.length} phone(s) shared by different candidates`);
dupP.slice(0, 15).forEach(([p, v]) => line(`       - ${p}: ${[...v].join(" + ")}`));

hdr("8. Needs attention");
flag(cands.filter((c) => c.review_status === "pending").length, `${cands.filter((c) => c.review_status === "pending").length} awaiting internal approval`);
flag(inProg.filter((c) => (now - +new Date(c.entered_stage_at)) / 86400000 > 10).length, `${inProg.filter((c) => (now - +new Date(c.entered_stage_at)) / 86400000 > 10).length} active candidate(s) idle > 10 days`);

line();
line("━━━ AUDIT COMPLETE ━━━");
