# ScoutforU ATS — Product Overview

_A Product Owner's map of everything the platform does today. Derived from the live routes, server actions, and database schema (not aspirational)._

**What it is:** a self-hosted, multi-role recruitment platform for a staffing agency — from sourcing candidates through placement, invoicing, and back-office HR/payroll — plus an owner-only finance suite. Runs on your own VPS; data in Supabase (Postgres + RLS + Storage).

**Roles:** `master_admin` (owner — full access), `recruiter` (isolated to their own jobs/candidates), `client` (sees only their own company's roles/candidates). Admin can preview the app "as a recruiter."

---

## 1. Recruitment Core

| Feature | Where | Status |
|---|---|---|
| **Pipeline (Kanban)** — drag candidates across stages | `/pipeline` | ✅ |
| **Candidates** — list, filters, Candidate 360 detail, notes/timeline | `/candidates` | ✅ |
| **Jobs / Requisitions** — create, approve, publish, client-name masking on public JDs | `/jobs` | ✅ |
| **Interviews** — schedule + email the candidate a calendar (.ics) invite | `/interviews` | ✅ |
| **Offers** | `/offers` | ✅ |
| **Talent pool & global search** | `/talent`, `/search` | ✅ |
| **Résumé parsing** — extract fields from an uploaded CV | `parse-resume` | ✅ |
| **Bulk operations** — bulk assign/edit, bulk résumé upload | `/bulk` | ✅ |
| **Disqualify reasons** (configurable) | admin settings | ✅ |
| **Stage-change automation** — auto-email on stage move | settings → automations | ✅ |

## 2. Careers & Sourcing (public)

| Feature | Where | Status |
|---|---|---|
| **Branded careers portal** — search, grid/list, deep-indigo hero | `/careers` | ✅ |
| **Job detail + easy apply** (no account needed) | `/careers/[jobId]` | ✅ |
| **Embeddable careers list** (for the company website) | `/careers/embed` | ✅ |
| **Public apply API** — résumé upload, **type-allowlisted, rate-limited, honeypot** | `/api/careers/apply` | ✅ |
| **Candidate import API** — per-recruiter token (job boards/inbox) | `/api/import-candidate` | ✅ |
| Client-name **masking** on all public JDs (agency confidentiality) | — | ✅ |

## 3. Placements & Revenue

| Feature | Where | Status |
|---|---|---|
| **Placements** — create/edit, list, detail, event timeline | `/placements` | ✅ |
| **Placement payments** tracking | placement detail | ✅ |
| **Invoices** — create/edit, line items, recurring | `/invoices` | ✅ |
| **Public invoice PDF** via unguessable token link | `/invoice/[token]` | ✅ |
| **Payments & invoice events** | invoice detail | ✅ |
| **Invoice settings** (branding, numbering) | admin settings | ✅ |

## 4. HR & Payroll (owner/HR)

| Feature | Where | Status |
|---|---|---|
| **Employees** register | `/employees` | ✅ |
| **Attendance** — admin view + self "My attendance" + settings | `/attendance`, `/my/attendance` | ✅ |
| **Leave** — requests, leave types, self "My leave" | `/leaves`, `/my/leave` | ✅ |
| **Payroll** — runs, per-run detail, **payslip PDF** (RLS-scoped) | `/payroll` | ✅ |
| **My payslips** (employee self-service) | `/my/payslips` | ✅ |
| **Incentives** config (recruiter %) | admin settings | ✅ |

## 5. Finance (owner-only, RLS admin-only)

| Feature | Where | Status |
|---|---|---|
| **Company finance** — expenses, categories | `/finance/company` | ✅ |
| **Personal finance** | `/finance/personal` | ✅ |
| **EMIs / commitments** (loan/insurance/SIP), auto-post on due | `/finance/emis` | ✅ |
| **Investments** | `/finance/investments` | ✅ |
| **Upcoming payments** | `/finance/upcoming` | ✅ |

## 6. Analytics & Reporting

| Feature | Where | Status |
|---|---|---|
| **Overview dashboard** | `/overview` | ✅ |
| **Analytics** | `/analytics` | ✅ |
| **Recruiter performance** (per-person) | `/performance/[id]` | ✅ |

## 7. Communication & Automation

| Feature | Where | Status |
|---|---|---|
| **Email templates** (picker in candidate messaging) | admin settings | ✅ |
| **Email config** — SMTP send + per-user IMAP reply detection | admin settings | ✅ |
| **Candidate messaging** | `candidate-message` | ✅ |
| **SMS to candidate** | admin settings → SMS | ⚠️ code ready; **provider keys not configured on VPS** |

## 8. Administration & Access

| Feature | Where | Status |
|---|---|---|
| **Team** — add users, **admin-only activate/deactivate** | `/team` | ✅ |
| **Recruiter data isolation** — RLS (DB-level) + app-layer scope | — | ✅ |
| **First-login forced password change** + voluntary change | `/change-password` | ✅ (needs migration 0042) |
| **Privilege-escalation guard** on profile self-updates | — | ✅ (needs migration 0043) |
| **Organization** branding + **logo upload** | admin settings | ✅ |
| **Custom fields, branches, approvers** | admin settings | ✅ |

---

## Deactivation / resignation behaviour (verified)
Deactivating a recruiter **only blocks her sign-in**. Her candidates, jobs, placements and notes remain in the system, stay attributed to her, and stay fully visible to the admin. No data is deleted — every person-linked foreign key is `on delete set null`, so records survive even a hard delete.

---

## Roadmap / gaps (Product Owner view)

**Should do before/around go-live**
1. **Reassign-on-resignation** — when deactivating, optionally hand her open pipeline (candidates/jobs) to another recruiter, so follow-ups don't stall. _(Recommended new feature — not built yet.)_
2. **SMS provider keys** (MSG91/Twilio) on the VPS to switch SMS on.
3. **Leaked-password protection** — enable in Supabase (free, 2 min).
4. **Careers → company website** sync (embed or `careers.` subdomain).

**Before scale**
5. **List pagination** — `getWorkspace()` loads the full dataset into memory; rework to server-side windowing before the pipeline hits a few thousand candidates (see QA report).
6. **Interview reminders** — scheduled cron for upcoming-interview nudges.

**Operational (done this week)**
- Nightly VPS backups for ATS + CRM; CRM loader wipe-bug fixed.

---

_Companion docs: [`QA_SECURITY_REPORT.md`](QA_SECURITY_REPORT.md) for the security/QA audit and test checklist._
