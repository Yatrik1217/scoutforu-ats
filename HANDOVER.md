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
**Pending: `0019_invoices.sql`** — paste it into the SQL Editor once to switch on
the Invoices module (tables + numbering function). Until then the Invoices pages
open but show "run migration 0019" when you try to save.
**Pending: `0021_placements.sql`** — switches on the Placements & Revenue tracker
(placements + payments + activity tables). Run it once in the SQL Editor too.
Then `0022_placement_tds.sql` + `0023_tds_on_base_fee.sql` (TDS tracking) and
`0024_incentives.sql` (recruiter incentive scheme). Note there are two files
numbered `0021` — `0021_job_publish.sql` is a separate careers change; run both.
**Pending: `0033_finance.sql`** — switches on the **Finance** module (expense &
P&L tracker at `/finance`). Paste it into the SQL Editor once. It creates
`finance_categories`, `finance_expenses`, `finance_emis` (all Master-Admin-only
via RLS) and seeds default personal + company categories. Until it's run, the
`/finance` pages open but stay empty and saving an entry errors.
**Pending: `0034_finance_investments.sql`** — adds a `type` (loan / insurance /
sip) and `current_value` to `finance_emis`, and repairs due dates. Run it after
`0033`. **Must** be applied before deploying the investments/insurance update, or
saving a loan/EMI errors with "column type does not exist". After it, optionally
reclassify any insurance you entered as a loan:
`update public.finance_emis set type='insurance', total_installments=0, paid_installments=0 where name ilike '%insurance%' or name ilike '%eterm%';`

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
- **Employee portal (Employees · Leave Requests · Payroll, Master Admin only)**:
  staff records with monthly gross salary (Basic/HRA breakdown can be added
  later), leave types with annual quotas, and a monthly payroll run. Staff apply
  for leave from their own login (**My Leave**) and download payslips
  (**My Payslips**) once a run is marked paid. Payroll pre-fills loss-of-pay from
  approved unpaid leave and pulls each recruiter's incentive automatically —
  earned this financial year minus whatever earlier payslips already paid, so it
  can never double-pay. Payslips are generated as PDFs.
- **Recruiter Performance (Admin → Performance, Master Admin only)**: leaderboard
  of fee booked / collected / outstanding / incentive per recruiter, filtered by
  month, quarter or **financial year (Apr–Mar)**. Click a recruiter for their
  placements, receipts and a step-by-step incentive working. Configure the scheme
  in General Settings → **Recruiter Incentives**, in three modes: a flat %, slabs
  on value, or **closure tiers** (quarterly per-closure rates + milestone bonus,
  half-yearly and annual bonuses — all per recruiter, on FY quarters). A closure
  counts only once the candidate completes the minimum tenure and the client's
  invoice is settled. The plan text lives in `docs/incentive-plan-2026.md`.
- **Placements & Revenue (Admin → Placements, Master Admin only)**: record each
  hire (candidate, client, date of joining, fee as % of CTC or a flat amount, GST),
  and the tracker computes what the client owes and when it's due (DOJ + 30/60/90
  days) plus the replacement-guarantee window. Dashboard shows expected revenue,
  overdue, due-in-30-days, collected, fee-booked-vs-collected chart, payments aging
  and top clients by outstanding. Record part-payments until Paid; mark
  replacement/cancelled/written-off; one click **Generate invoice** turns a
  placement into a draft in the Invoices module. Candidate picker autofills from
  ATS candidates in Offered/Accepted/Joined stages.
- **Invoicing (Admin → Invoices, Master Admin only)**: dashboard of receivables,
  overdue & expected payments · **New Invoice** (client autofill, GST CGST/SGST or
  IGST, discount, terms) · Send emails the PDF + a public "View Invoice" link
  (needs SMTP, §4) · Record payments (UPI/bank/cheque…) until Paid · Remind,
  duplicate, void, write off · **Recurring** profiles auto-draft retainer invoices
  when their date arrives. Numbering/GSTIN/PAN/bank details come from General
  Settings → Invoice Setting.
- **Finance (Finance in the sidebar, or `/finance`, Master Admin only)**: a
  **separate product surface** with its own green-accented shell, sitting beside
  the ATS but owner-only (personal money lives here, so no recruiter/client can
  see it). Two separate books tracked side by side:
  - **Personal** — home, petrol, groceries, EMIs and everyday spend/income.
  - **Company (ScoutforU)** — operating expenses, with a real **P&L and EBITDA**.
    Company **revenue is pulled automatically** from placement receipts
    (`placement_payments`) for the chosen period — no double entry. EBITDA =
    revenue − operating expenses; categories flagged *"below EBITDA"* (Interest,
    Taxes, Depreciation) are excluded so the figure is correct, and Net Profit
    subtracts them. Toggle **This FY / This month** on the dashboard & company page.
  - **EMIs & Loans** — record each loan (monthly EMI, total installments, due day,
    start date); the tracker shows the **next due date, days-to-due, outstanding
    balance and repayment progress**. **Pay EMI** advances the schedule and drops a
    matching expense line into the ledger so the P&L reflects it automatically.
  - **Categories** — manage the expense heads for both books; mark company
    Interest/Tax/Depreciation as *below EBITDA*.
  Needs migration `0033_finance.sql` (§2). Built as a route group so it shares your
  one login and Vercel deploy but is its own dashboard — `/finance`.

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
