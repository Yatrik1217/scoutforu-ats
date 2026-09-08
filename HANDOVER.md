# ScoutforU — ATS + CRM Handover & Operations Guide

_Last updated: September 2026. This is the single reference for running, fixing, and
extending the two systems. Give it to any developer you hire._

---

## 1. What you have

| System | What it does | Lives at | Repo |
|---|---|---|---|
| **ATS** | Recruitment: jobs, candidates, pipeline, attendance, payroll, Talent Bank, finance, careers page | `ats.scoutforu.com` | `github.com/Yatrik1217/scoutforu-ats` |
| **CRM** | Sales outreach: contacts, campaigns, deals, team performance, attendance | `crm.scoutforu.com` | `github.com/Yatrik1217/scoutforu-crm` |
| **Careers (public)** | Job seekers browse & apply | `ats.scoutforu.com/careers` (+ `/careers/embed` for the website) | (part of the ATS) |

Both apps run on **one Hostinger VPS** and share **one Supabase project**.

- **ATS** = Next.js 16 (React, server components) + Supabase Postgres.
- **CRM** = Node/Express; its entire database is a single JSON file (`db.json`) in Supabase Storage — not SQL tables.

---

## 2. Infrastructure & logins you must keep

| Thing | Detail |
|---|---|
| **VPS** | Hostinger, `ssh root@200.141.9.192`. Apps in `/opt/scoutforu-ats` and `/opt/scoutforu-crm`. Node 22, pm2 7. Prepaid 3-year plan. |
| **Process manager** | `pm2` — process names **`ats`** and **`crm`** (and `finance` if present). `pm2 list` shows status. |
| **Supabase** | One project (dashboard at supabase.com). Holds the ATS Postgres DB **and** the CRM's `db.json` (Storage bucket `crm`) and resume files (bucket `resumes`), logos (bucket `branding`). Free tier. |
| **Domains / DNS** | `scoutforu.com` DNS (Hostinger). `ats.` and `crm.` subdomains point to the VPS; MX records point to **Zoho** for email — do not remove MX. |
| **Email** | Zoho mailboxes. Shared sender `career@scoutforu.com`. Recruiters can send from their own mailbox (ATS → My Email). |
| **Anthropic API** | Pay-as-you-go credits (console.anthropic.com → Plans & Billing). Used ONLY for resume parsing, JD-match scoring, and candidate-email rendering. ~₹0.3–0.5 per resume/score. Keep a small balance or enable auto-reload. |
| **Backups** | Nightly VPS backups of both Supabase blobs exist (see the crontab on the VPS). |

**Recurring cost after you stop using Claude Code:** VPS (already prepaid) + Supabase (free) + Anthropic (only when you parse/score — usage-based, tiny). The apps do **not** need Claude Code to keep running.

---

## 3. How deployment works (READ THIS FIRST when a change "isn't showing")

**Normal flow:** you `git push` to `main` → two things race to deploy it, so it always goes live within ~3 minutes:
1. **GitHub Action** (`.github/workflows/deploy.yml` in each repo) — SSHes to the VPS, pulls, builds (ATS), reloads pm2. Fast path.
2. **VPS cron reconciler** (`/opt/deploy-reconcile.sh`, runs every 3 min) — if the server is behind `origin/main`, it deploys. Backstop for when the Action doesn't fire.

Both use a lock so they never collide. The reconciler only rebuilds when there's a new commit, and (for the ATS) only restarts the app **if the build succeeds** — so a bad build can't take the site down.

**To check a deploy landed:**
```bash
ssh root@200.141.9.192 "cd /opt/scoutforu-ats && git rev-parse --short HEAD"   # should match your latest commit
ssh root@200.141.9.192 "pm2 describe ats | grep -E 'status|uptime'"            # uptime resets when it reloaded
tail -20 /var/log/deploy-reconcile.log                                          # reconciler activity
```

**Manual deploy (if ever needed):**
```bash
ssh root@200.141.9.192 "cd /opt/scoutforu-ats && git fetch origin main && git reset --hard origin/main && npm install && npm run build && pm2 reload ats"
# CRM (no build step):
ssh root@200.141.9.192 "cd /opt/scoutforu-crm && git fetch origin main && git reset --hard origin/main && npm install --omit=dev && pm2 reload crm"
```

---

## 4. Database & migrations

### ATS (Supabase Postgres)
- Schema changes live in `supabase/migrations/*.sql` (numbered, e.g. `0052_...`).
- **⚠️ Migrations are NOT auto-applied.** After deploying code that needs a new column/table, open **Supabase → SQL Editor**, paste the migration SQL, and run it. If a feature "doesn't save," a migration is usually the missing step.
- Row-Level Security (RLS) governs who sees what: `master_admin` sees everything; a recruiter sees only their assigned jobs/candidates; a client sees only their own.

### CRM (JSON blob, not SQL)
- The **entire** CRM database is one JSON object at Supabase Storage → bucket `crm` → `db.json`.
- The running CRM keeps it in memory (a cache) and writes the whole blob on any change (last-write-wins).
- **Never hand-edit that blob from outside the running app** — the live process will overwrite it. Change CRM data through the CRM UI/API, which updates the cache and the blob together.

---

## 5. ATS — how it's built

- **Framework:** Next.js 16 (App Router). Pages in `src/app/(app)/…` (staff app), `src/app/careers/…` (public), server actions in `src/lib/actions/…`.
- **Pipeline stages** are editable per client: table `pipeline_stages` (a Default set + optional per-client overrides). Code resolves them via `src/lib/pipeline.ts` / `pipeline-core.ts`. A candidate's `stage` is a slug that must exist in that pipeline; the board's first column now absorbs any unknown slug so nobody is ever hidden.
- **Key server actions** (`src/lib/actions/`): `mutations.ts` (candidates, jobs, stages, job-assignment emails), `hr.ts` (attendance, payroll, holidays, leave), `talent-bank.ts`, `jd-score.ts`, `finance.ts`, `automations.ts`, `parse-resume.ts` (+ `ai/extract.ts`).
- **AI features** use `claude-haiku-4-5` via `@anthropic-ai/sdk`:
  - **Resume parsing** (Talent Bank + bulk upload) — `parse-resume.ts`.
  - **JD-match score** — `jd-score.ts` (on-demand button on a candidate, cached in `candidates.jd_match`).
- **Attendance/payroll:** staff check in themselves; unmarked past working days = Absent; holidays (`holidays` table) and weekly-offs are paid. A CRM-linked employee (`attendance_source='crm'`) has their attendance read live from the CRM and is shown once, view-only.
- **Careers:** public jobs come from a curated `public_jobs` view (client names redacted). JD supports rich text (bold/italic/lists), stored as sanitized HTML.

## 6. CRM — how it's built

- **Framework:** Express (`app.js` = routes, `server.js` = start). SPA front-end in `public/index.html` (hash-router).
- **Storage:** `lib/store.js` loads/saves `db.json` (see §4). `getSharedHolidays()` reads the ATS `holidays` table so CRM attendance honours the same company holidays (read-only; never written into the CRM blob).
- **Team view** (admin): per-salesperson leaderboard; every metric is drillable (Leads → contacts, Pipeline ₹ → that person's deals, etc.).
- **Attendance:** salespeople check in from the CRM; the ATS reads it read-only for the Register and for payroll.

---

## 7. Runbooks — "how do I…"

- **Deploy a change:** commit + `git push` to `main`. Wait ~3 min. Verify with §3.
- **Run a migration:** Supabase → SQL Editor → paste the file from `supabase/migrations/` → Run.
- **Add a company holiday:** ATS → Settings → Attendance & Holidays → Add. It flows to the register, payroll, and the CRM automatically.
- **Add / deactivate a user:** ATS → Users & Roles → Add User / Deactivate.
- **Close a job:** open the job → it moves to the "Closed jobs" section; active count drops.
- **Assign a recruiter to a job:** edit the requisition → the newly-added recruiter is emailed automatically.
- **Run payroll:** ATS → Payroll → pick the month → "Sync employees" adds anyone missing (e.g. a new hire or CRM salesperson) → adjust a line if needed → Finalise → Mark as paid. Payslip has the logo + attendance breakdown.
- **Top up AI credits:** console.anthropic.com → Plans & Billing → Purchase credits (or enable auto-reload). ~₹0.3–0.5 per resume parsed/scored.
- **Restart an app:** `ssh root@200.141.9.192 "pm2 reload ats"` (or `crm`).
- **Read app logs:** `ssh root@200.141.9.192 "pm2 logs ats --lines 100"`.
- **Daily recruiting summary email:** a VPS cron hits `GET /api/cron/team-digest?key=$CRON_SECRET` at **7:00 AM IST** (01:30 UTC) and emails a per-recruiter summary (active load, stalled >10d, this-week velocity, conversion %, top openings). Recipients = `DIGEST_TO` in `/opt/scoutforu-ats/.env.local` (currently the owner's email) or, if unset, all active master admins. Change the time with `crontab -e`; change recipients by editing `DIGEST_TO` then `pm2 reload ats`. Log: `/var/log/team-digest.log`. Send a test now: `curl "https://ats.scoutforu.com/api/cron/team-digest?key=<CRON_SECRET>"`.

---

## 8. Known trade-offs & gotchas (so you're not surprised)

- **Migrations are manual** (§4) — the #1 cause of "feature doesn't work after deploy."
- **CRM leave = unpaid (LWP)** in payroll by default (correct for probation staff). A *confirmed* CRM salesperson's *paid* leave would be over-docked — adjust that payroll line manually.
- **Mid-month proration** applies only to *newly-built* payroll lines. To recompute an existing line after attendance changes: delete that line, then "Sync employees".
- **Deleting a job orphans its candidates** (their job link is cleared) — they stop showing in that job's pipeline. Prefer **closing** a job over deleting it.
- **Logos must be PNG/JPG**, not SVG — the PDF/payslip engine can't embed SVG. (Yours is already a PNG.)
- **Talent Bank folders** are auto-named from job title/skills; a handful of niche resumes land in "Other" — that's expected.
- **CRM blob is last-write-wins** — heavy concurrent editing could drop a change. Fine at your scale.
- **Anthropic credit empty** → resume parsing / JD scoring stops with a clear "top up credits" banner; nothing else breaks.

---

## 9. Troubleshooting quick table

| Symptom | Look here |
|---|---|
| A code change isn't live | §3 — check VPS HEAD vs your commit; check the reconciler log; manual deploy |
| Feature saves nothing / errors about a missing column | An un-run migration (§4) |
| A candidate isn't on the board | Their stage slug, or they have no job (deleted job) — see §8 |
| Resume parse / JD score fails | Anthropic credit balance (console → Billing) |
| Candidate/assignment email didn't send | Zoho mailbox config (ATS → My Email / Settings); the shared `career@` SMTP |
| CRM shows stale data | The CRM caches the blob in memory — `pm2 reload crm` forces a fresh read |
| Site down | `pm2 list`; `pm2 reload ats`/`crm`; check `pm2 logs` |

---

## 10. Who can maintain this

Standard, common stack — any mid-level full-stack developer can run it:
- **ATS:** Next.js (App Router) + TypeScript + Supabase (Postgres, Auth, Storage) + Tailwind.
- **CRM:** Node.js + Express + vanilla JS SPA + Supabase Storage.
- **Ops:** a Linux VPS with pm2 + GitHub Actions.

Give them: this file, access to the two GitHub repos, the Supabase project, the VPS, and the Anthropic/Zoho logins. Everything else is documented above.
