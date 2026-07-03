// Receives the candidate payload (name, profile text, captured résumé file, CV
// HTML snapshot) from the content script and POSTs it to the ScoutforU ATS
// import endpoint using the stored base URL + API token. The résumé file is
// captured in-page by inject.js, so the worker just forwards everything.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "import") return;
  chrome.storage.sync.get(["baseUrl", "token"], async (cfg) => {
    if (!cfg.baseUrl || !cfg.token) {
      sendResponse({ ok: false, error: "Set the ATS URL + token in the extension popup" });
      return;
    }
    try {
      const resp = await fetch(cfg.baseUrl.replace(/\/$/, "") + "/api/import-candidate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-token": cfg.token },
        body: JSON.stringify(msg.data),
      });
      const json = await resp.json().catch(() => ({ ok: false, error: "Bad response" }));
      sendResponse(json);
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
  return true; // async response
});
