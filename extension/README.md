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
- **Résumé file** — on Import the extension clicks Naukri's own **Download CV** button while an in-page interceptor (`inject.js`, runs in the page's JS context) hooks `fetch` / `XMLHttpRequest` / `URL.createObjectURL` / résumé link clicks and captures the file **the instant the page produces it** — including blob downloads a background worker can't re-fetch. That original PDF/DOC is stored in the ATS, attached to the candidate, and parsed. If no file is produced, the rendered CV is saved as an `.html` snapshot so a résumé is attached either way.

## How the résumé capture works
`inject.js` is declared as a `world: "MAIN"`, `document_start` content script, so its network hooks are installed before Naukri's own code runs. When you click Import, `content.js` clicks the Download CV control and waits ~7s for the intercepted file, then submits. This is the same in-page interception technique other Naukri "RM integrator" extensions use — no `downloads` permission and no broad host access needed.

## Notes & limits
- **Unlock the profile first** — contact details and the CV download are only available on unlocked profiles.
- Each import clicks Naukri's Download CV button; if your Naukri plan meters CV downloads, that applies here too.
- The download-button selector lives in `clickCvDownload()` in `content.js`; the **🔍 CV debug** button shows what the current page exposes if Naukri changes its markup.
- If the original file can't be captured on a given profile, the candidate still imports fully (details + `.html` CV snapshot). Use **🔍 CV debug** and share the output to tune the selectors.
- If you use a **custom domain**, update `host_permissions` in `manifest.json` and the ATS URL in the popup.
- ⚠️ Automated export from Resdex may be subject to Naukri's Terms of Service — confirm against your Naukri agreement.
