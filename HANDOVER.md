# ScoutforU ATS — Owner's Operations Manual

Everything you need to run, maintain and extend this ATS without the original
development chat. Written 8 Jul 2026.

---

## 1. Where everything lives

| Piece | Location | Login |
|---|---|---|
| Live app | https://scoutforu-ats.vercel.app | your ATS login (yatrik@scoutforu.com) |
| Public careers page | https://scoutforu-ats.vercel.app/careers | none (public) |
| Code | https://github.com/Yatrik1217/scoutforu-ats + this folder | your GitHub account |
| Hosting / deploys / env vars | https://vercel.com → project **scoutforu-ats** | your Vercel account |
| Database, auth, résumé files | https://supabase.com → project **bnuaxzbnsvtpdpdkctoi** | your Supabase account |
| AI parsing credits | https://console.anthropic.com (API billing — separate from Claude Pro) | your Anthropic account |
| Chrome extension | `extension/` folder in this repo, loaded via chrome://extensions → Load unpacked | — |
| Secrets file | `.env.local` in this folder (NOT in GitHub) + backup in `~/Documents/scoutforu-ats-env-backup-*.txt` | keep private |

## 2. How changes get deployed

1. Edit code (or have a developer/Claude do it).
2. Commit, then **push to GitHub** (GitHub Desktop → Push origin).
3. Vercel builds and deploys automatically (~2 min). No other step.

Database changes are separate: run the SQL file (in `supabase/migrations/`)
once in **Supabase → SQL Editor**. All migrations up to `0018` are already applied.

## 3. Environment variables

Set in **Vercel → Settings → Environment Variables** (production) and mirrored
in `.env.local` (local dev). After changing any var in Vercel, **redeploy**
(Deployments → ⋯ → Redeploy) — env changes only apply to new deployments.

| Variable | Purpose | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app ↔ database | ✅ set |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side admin ops (imports, user creation, careers apply) | ✅ set |
| `ANTHROPIC_API_KEY` | AI résumé parsing (~₹0.35/résumé; top up at console.anthropic.com) | ✅ set |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` (`SMTP_FROM` optional) | client emails, credential emails | ⚠️ **not set yet** — see §4 |
| `SMS_PROVIDER` + `MSG91_AUTH_KEY`/`MSG91_SENDER` or `TWILIO_*` | SMS gateway (optional) | not set |

## 4. Switch on email (the one pending setup)

1. Zoho Mail → **My Account → Security → App Passwords** → generate one for "ScoutforU ATS".
2. Vercel → Settings → Environment Variables → add:
   `SMTP_HOST=smtp.zoho.in` · `SMTP_PORT=465` · `SMTP_USER=yatrik@scoutforu.com` · `SMTP_PASS=<the app password>`
3. Redeploy. Test: Candidates → **Share with Client** → send to your own email.
This unlocks: client tracker emails with résumés, emailed login credentials,
and Admin → General Settings → Email shows "Configured ✓".

## 5. Everyday admin tasks

- **Add a recruiter/client login**: Admin → **Add User** (or bulk: General Settings → Import Data → Recruiters).
- **Deactivate a recruiter**: Admin → toggle next to their name.
- **Approve profiles**: recruiters moving a candidate to Screening triggers
  "Awaiting internal approval" — approve/send back from the candidate drawer.
  Manage who approves: General Settings → Approvers.
- **Share candidates with a client**: Candidates page (filter first if you want) → Share with Client.
- **Resdex import**: Chrome extension button on an unlocked profile. Token lives in
  Admin → Résumé Import Token; extension settings in its popup.
- **Bulk import**: General Settings → Import Data (Excel/CSV) or Bulk Upload (résumé PDFs, AI-parsed).
- **Rejection reasons / custom fields / templates / org info / invoice details**: General Settings tiles.

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| "Resume parsing is not configured / credit balance too low" | `ANTHROPIC_API_KEY` missing in Vercel, or API credits exhausted — top up at console.anthropic.com, then redeploy. |
| Share with Client says email not configured | §4. |
| Share blocked: "Not approved for client submission" | approve the named profiles in their drawer first (that's the approval gate working). |
| Extension import fails / 401 | regenerate token in Admin → paste into extension popup → Save. |
| Extension stopped capturing after Chrome/Naukri update | chrome://extensions → Remove → Load unpacked `extension/` again, refresh the Resdex tab. |
| Site down / build failed | Vercel → Deployments → open the failed build log; a previous deployment can be promoted ("Promote to Production") while investigating. |
| Forgot a password | Supabase → Authentication → Users → reset; or delete + re-add the user from Admin. |

## 7. Resuming development later

Any of these work — the codebase is standard Next.js 16 + Supabase, nothing proprietary:
- **Claude Code with API billing** (no Pro subscription needed): `npm i -g @anthropic-ai/claude-code`, run `claude` in this folder with `ANTHROPIC_API_KEY` set — pay per use.
- **Resubscribe to Claude Pro** for a month when you have a batch of changes.
- **Any developer**: point them at this file + `README`/migrations; local dev is
  `npm install && npm run dev` with `.env.local` present.

## 8. Security rules

- `.env.local` must never be committed or shared — it contains the service-role key
  (full database access) and API keys.
- If any key leaks: Supabase → Settings → API (rotate), Anthropic console (rotate),
  then update the value in **both** Vercel and `.env.local`.
- The Supabase service key and Anthropic key were pasted in a support chat during
  development — rotating them at your convenience is recommended.

## 9. Known limits (by design, documented honestly)

- Resdex import captures the CV as rendered (PDF when Naukri exposes it, else a clean
  HTML snapshot) — the *original* file is only available via Naukri's paid API.
- Admin toggles "Email Notifications", "Auto-reject stale", "Two-Factor" are placeholders — not wired to automation yet.
- Calendar sync is .ics file download; two-way Google/Zoho Calendar OAuth was scoped but needs your OAuth app credentials to build.
- Pipeline stages are fixed (9 stages); internal/client approval is handled by the approval workflow instead of custom stages.
