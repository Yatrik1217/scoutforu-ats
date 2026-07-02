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

## Notes & limits
- The scraper reads **only what's visible on the page** — masked/locked contact details won't be captured.
- Resdex's HTML changes over time; if a field isn't captured, tune the selectors in `content.js` (`scrape()`).
- If you use a **custom domain**, update `host_permissions` in `manifest.json` and the ATS URL in the popup.
- ⚠️ Automated export from Resdex may be subject to Naukri's Terms of Service — confirm against your Naukri agreement.
