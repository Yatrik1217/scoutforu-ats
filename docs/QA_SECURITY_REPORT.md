# ScoutforU ATS — QA & Security Report

_Prepared before handing recruiter logins to the team and the codebase to a developer._
_Scope: static code/security audit + a manual test plan. No destructive tests were run against production data._

---

## Final QA cycle — session close

**Automated tests:** `npm test` → **27/27 finance + 11/11 attendance passing.** New attendance→payroll tests (`test/hr/attendance.test.mts`) cover the weekly-off policy (6-day, alternate Saturdays), auto-absent boundaries (past/today/future, joining/exit, weekly-off), the "Present 8 / Absent 1" register scenario, holiday & leave exclusion, and LOP→net-pay.

**Build & lint:** production `next build` compiles clean; `eslint` clean on all touched files.

**Security:** all **38** tables have RLS enabled (new `job_recruiters` and `holidays` included). New mutations are admin-gated (`addHoliday`, `deleteHoliday`, `updateAttendanceSettings`, `reassignRecruiterWork`, `setUserActive`); the profile privilege-escalation trigger (0043) is live. Service-role key remains server-only.

**Performance:** no N+1 introduced — payroll's per-employee calc (LOP incl. auto-absents) is pure in-memory; page loads use batched `Promise.all` fetches.

**DB migrations verified live in Supabase:** 0042 (first-login password), 0043 (privilege guard), 0044 (co-recruiting), 0045 (weekly-off policy), 0046 (holidays) — all applied.

**Not covered (needs a human):** live multi-user click-through with real logins, cross-browser/mobile rendering, and real load testing — see the manual checklist below.

---

## Verdict

The ATS is in **good shape to hand to recruiters**, with a **strong data-isolation and access-control posture**. No critical (P1) vulnerabilities were found. A few medium/low hardening items are listed below; two were fixed in this pass.

> ⚠️ **Deploy prerequisite:** apply migration **`0042_must_change_password.sql`** in the Supabase SQL editor before/at deploy. Until it runs, the new first-login password-change feature is inert (the column doesn't exist).

---

## ✅ What's strong (verified in code)

| Area | Finding |
|---|---|
| **Row-Level Security** | **All 36 tables have RLS enabled.** Recruiters are isolated at the DB level (not just the UI) via `job_in_scope()` / `candidate_in_scope()` helpers. |
| **Finance data** | Personal finance tables (`finance_expenses`, `finance_emis`) are **admin-only** via `is_admin()` RLS policy **and** an app-layer `master_admin` guard on the `(finance)` layout. |
| **Service-role key** | Used **server-side only** — never imported into a `"use client"` component; not exposed to the browser bundle. |
| **Public invoice PDF** | Gated by an unguessable `public_token` (`^[a-f0-9]{24,64}$`), not a sequential id — no IDOR. |
| **Candidate import API** | Authenticated by a **per-recruiter API token**; rejects inactive/`client` accounts. |
| **Payslip PDF** | Uses the **user session (RLS applies)** — an employee can only fetch their own line; admin sees all. |
| **Deactivated accounts** | Blocked at login (`profiles.active === false` → forced sign-out). |
| **Auth on mutations** | Server actions call `auth.getUser()` + role checks before writes; user creation is `master_admin`-only. |

---

## Findings & recommendations

### 🟠 P2 — Medium

1. **Public endpoint rate-limiting / bot protection.** _(FIXED this pass — see below.)_

2. **Résumé upload previously accepted any file type.** _(FIXED this pass — see below.)_

### 🟡 P3 — Low / hardening

3. **Password policy is minimal** — 8-char minimum, no breach check.
   **Fix (free):** in Supabase → Auth → Policies, enable **"Leaked password protection"** (HaveIBeenPwned) and consider a 10-char minimum.

4. **Temp password emailed in plaintext.** Unavoidable for a temp credential, and now **mitigated** by the forced first-login change — but consider a magic-link/invite flow later so no password is ever emailed.

5. **A few unbounded list selects** (`candidates` without `.limit/.range`). Harmless at current volume; add pagination before the pipeline grows to thousands of rows. 39 DB indexes already exist — index coverage is good.

---

## 🔧 Fixed in this pass

- **Public-endpoint rate-limiting + honeypot** (`/api/careers/apply`): 10 submissions per 15 min per IP (HTTP 429 beyond that), plus a hidden honeypot field that silently drops bots. In-memory limiter (`src/lib/rate-limit.ts`) — sufficient for the single pm2 process; move to Redis only if scaled to multiple instances.
- **Résumé upload allowlist** (`/api/careers/apply`): now restricted to real document types (`pdf, doc, docx, rtf, odt, txt`); the browser-supplied MIME is no longer trusted (a fixed content-type is set per extension). Blocks storing `.html`/`.svg`/executable payloads via the public endpoint.
- **Stale welcome-email URL** fixed (was the old Vercel URL → now `NEXT_PUBLIC_APP_URL` / `ats.scoutforu.com`).
- **First-login password change** shipped (see feature notes below).

---

## New feature: first-login password change

- Admin creates a login with a temporary password → new user gets `must_change_password = true` (set by the new-user trigger from auth metadata).
- On first sign-in the `(app)` and `(finance)` layouts redirect to **`/change-password`**; the user can't reach any other page until they set a new password. The flag is then cleared.
- A voluntary **"Change password"** item was added to the account menu.

**Test it:** create a recruiter in Admin → Team → sign in as them → confirm you're forced to `/change-password` → set a new password → confirm you land in the app and the old temp password no longer works.

---

## Manual test checklist (smoke + functional)

Run as **each role** (Master Admin, Recruiter, Client). ✅ = pass.

### Smoke (every page loads, no console errors)
- [ ] Login, Pipeline, Jobs, Candidates, Placements, Invoices, Attendance, Payroll, Reports, Settings, Careers (public), Change-password.

### Access control (the important one)
- [ ] Recruiter **cannot** see another recruiter's candidates/jobs (list + by direct URL `/candidates/<id>`).
- [ ] Recruiter **cannot** open `/overview` finance pages (should redirect).
- [ ] Client login sees **only** their own company's data.
- [ ] Deactivate a user → they're signed out and can't log back in.
- [ ] Only Master Admin sees Team / can add users / can delete a JD.

### Functional
- [ ] Create job → approve → publish → appears on `/careers`; client name is **masked** in the public JD.
- [ ] Apply on careers page (with/without résumé) → candidate appears in Sourced; non-document file is rejected.
- [ ] Move candidate through stages → stage-change auto-email fires (if configured).
- [ ] Schedule interview → candidate receives email + calendar invite.
- [ ] Raise invoice → public token link renders PDF; record a payment → balance updates.
- [ ] Run payroll → payslip PDF downloads; an employee sees only their own.

### What a human/tester still needs to cover
- Live multi-user session testing (I can't log in without credentials).
- Cross-browser / mobile rendering.
- Real load/performance testing (this report covers static analysis only).

---

## Suggested priority for the developer
1. ~~Add rate-limiting to public endpoints~~ — **done.**
2. Turn on Supabase leaked-password protection (P3 #3 — 2 minutes, free, Supabase dashboard).
3. **Pagination is architectural, not a bolt-on.** `getWorkspace()` (`src/lib/data.ts`) loads the *entire* dataset (all candidates/jobs/interviews/offers) into memory, and the Kanban board + filters operate on the full set client-side. Real pagination means server-side windowing + reworking those views. Do **not** add a silent row cap (it would hide records). Schedule this as a dedicated task before the pipeline approaches a few thousand candidates.
