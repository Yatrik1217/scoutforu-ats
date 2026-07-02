# ScoutforU — Resdex Import (Chrome extension)

One-click import of a Naukri Resdex candidate into your ScoutforU ATS pipeline.

## Install (developer mode)
1. Open **chrome://extensions**, toggle **Developer mode** (top-right).
2. Click **Load unpacked** → select this `extension/` folder.
3. Click the extension icon → **popup** → set:
   - **ATS URL**: your deployed app, e.g. `https://scoutforu-ats.vercel.app`
   - **Import token**: from the ATS → **Admin → Resume Import Token → Generate**
   - **Save**.

## Use
1. In Naukri Resdex, open a candidate profile (**unlock** it first if you want phone/email — Resdex hides those until unlocked).
2. Click the floating **➕ Import to ScoutforU** button (top-right).
3. The candidate is added to your **Sourced** stage (or flagged if already in your database).

## What gets imported
- **Candidate details** — the extension sends the profile text; the ATS server runs AI extraction (the same engine as resume upload) to fill experience, CTC, location, notice, company, designation, education, skills, and the candidate's own email/phone. Recruiter/portal/support contacts are ignored, so different candidates don't collide as duplicates.
- **Résumé file** — if the profile shows a downloadable/rendered CV (PDF/DOC/DOCX), it's fetched, stored in the ATS, and attached to the candidate (downloadable from the candidate drawer). The file is also parsed for the most accurate fields.

## Notes & limits
- Contact details on Resdex are masked until you **unlock** the profile — unlock first for email/phone.
- Résumé capture depends on the CV being present on the page (a viewer iframe or a download link). If a profile has no visible/downloadable CV, the candidate still imports (from profile text) without a file attached.
- Resdex's HTML changes over time; if the résumé file isn't captured, tune `resumeUrls()` in `content.js`.
- If you use a **custom domain**, update `host_permissions` in `manifest.json` and the ATS URL in the popup.
- ⚠️ Automated export from Resdex may be subject to Naukri's Terms of Service — confirm against your Naukri agreement.
