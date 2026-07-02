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
- **Résumé file** — Resdex has no fetchable résumé URL, so on Import the extension clicks Naukri's own **Download CV** button and captures the resulting file via Chrome's downloads API (the file is *not* left in your Downloads folder). It's stored in the ATS, attached to the candidate (downloadable from the drawer), and parsed for the most accurate fields.

## Permissions (why)
- `downloads` — to capture the CV file produced by Naukri's download button and cancel the disk copy.
- `<all_urls>` (host) — the CV may be served from a Naukri CDN/S3 host that isn't known ahead of time; the worker must be able to re-fetch that file. It is only ever used to fetch the triggered résumé download and to POST to your ATS.

## Notes & limits
- **Unlock the profile first** — contact details and the CV download are only available on unlocked profiles.
- Each import clicks Naukri's Download CV button; if your Naukri plan meters CV downloads, that applies here too.
- The download-button selector lives in `clickCvDownload()` in `content.js`; the **🔍 CV debug** button shows what the current page exposes if Naukri changes its markup.
- If the CV download is a `blob:`/`data:` URL (not a server URL), the worker can't re-fetch it — the candidate still imports from profile text without a file. Use **🔍 CV debug** and share the output to adjust.
- If you use a **custom domain**, update `host_permissions` in `manifest.json` and the ATS URL in the popup.
- ⚠️ Automated export from Resdex may be subject to Naukri's Terms of Service — confirm against your Naukri agreement.
