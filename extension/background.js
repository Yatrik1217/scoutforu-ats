// Receives scraped candidate data from the content script, tries to fetch the
// candidate's resume file (using naukri.com host permission — bypasses page
// CORS), and POSTs everything to the ScoutforU ATS import endpoint.

function abToB64(ab) {
  const bytes = new Uint8Array(ab);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function nameFromUrl(url, type) {
  let fn = (url.split("#")[0].split("?")[0].split("/").pop() || "resume").slice(0, 80);
  if (!/\.(pdf|docx?|rtf)$/i.test(fn)) {
    const ext =
      /pdf/i.test(type) ? "pdf" :
      /wordprocessingml|docx/i.test(type) ? "docx" :
      /msword/i.test(type) ? "doc" : "pdf";
    fn = fn.replace(/[^\w.-]+/g, "_") + "." + ext;
  }
  return fn;
}

// Try each candidate URL; return the first that looks like a real resume file.
async function fetchResume(urls) {
  for (const url of urls || []) {
    try {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) continue;
      const type = r.headers.get("content-type") || "";
      // Skip HTML pages / viewers that aren't the file itself.
      if (/text\/html/i.test(type)) continue;
      const ab = await r.arrayBuffer();
      if (ab.byteLength < 1000 || ab.byteLength > 7 * 1024 * 1024) continue;
      const isDoc =
        /pdf|msword|wordprocessingml|officedocument|rtf|octet-stream/i.test(type) ||
        /\.(pdf|docx?|rtf)(\?|#|$)/i.test(url);
      if (!isDoc) continue;
      return { name: nameFromUrl(url, type), type: type || "application/pdf", dataBase64: abToB64(ab) };
    } catch {
      /* try next */
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "import") return;
  chrome.storage.sync.get(["baseUrl", "token"], async (cfg) => {
    if (!cfg.baseUrl || !cfg.token) {
      sendResponse({ ok: false, error: "Set the ATS URL + token in the extension popup" });
      return;
    }
    try {
      const data = { ...msg.data };
      const urls = data.resumeUrls;
      delete data.resumeUrls;
      const resumeFile = await fetchResume(urls);
      if (resumeFile) data.resumeFile = resumeFile;

      const resp = await fetch(cfg.baseUrl.replace(/\/$/, "") + "/api/import-candidate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-token": cfg.token },
        body: JSON.stringify(data),
      });
      const json = await resp.json().catch(() => ({ ok: false, error: "Bad response" }));
      if (json && json.ok && resumeFile && json.status === "created") json.withResume = true;
      sendResponse(json);
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
  return true; // async response
});
