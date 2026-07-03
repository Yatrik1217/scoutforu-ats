// Posts the candidate payload to the ScoutforU ATS, and (on request) fetches a
// résumé/viewer URL captured in-page — following one "viewer page" hop to the
// embedded file if needed — since the background worker can reach cross-origin
// hosts (Naukri CDN / S3) that the page's own fetch can't.

function abToB64(ab) {
  const bytes = new Uint8Array(ab);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function nameFromUrl(url, type, cd) {
  let fn = "";
  if (cd) {
    const m = /filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)/i.exec(cd);
    if (m) { try { fn = decodeURIComponent(m[1]); } catch { fn = m[1]; } }
  }
  if (!fn) fn = ((url || "").split("#")[0].split("?")[0].split("/").pop() || "resume").slice(0, 80);
  if (!/\.(pdf|docx?|rtf)$/i.test(fn)) {
    const ext = /pdf/i.test(type) ? "pdf" : /wordprocessingml|docx/i.test(type) ? "docx" : /msword/i.test(type) ? "doc" : "pdf";
    fn = (fn.replace(/[^\w.-]+/g, "_") || "resume") + "." + ext;
  }
  return fn;
}

const DOC_CT = /(pdf|msword|officedocument|wordprocessingml|rtf|application\/octet-stream)/i;

// Fetch a URL; if it's a document, return the file. If it's an HTML viewer page,
// look for an embedded file URL (iframe/embed src or a .pdf link) and fetch that.
async function fetchDoc(url, depth) {
  if (!url || depth > 1) return null;
  let r;
  try {
    r = await fetch(url, { credentials: "include" });
  } catch {
    return null;
  }
  if (!r.ok) return null;
  const ct = r.headers.get("content-type") || "";
  if (DOC_CT.test(ct) || /\.(pdf|docx?|rtf)(\?|#|$)/i.test(url)) {
    const cd = r.headers.get("content-disposition") || "";
    const ab = await r.arrayBuffer();
    if (ab.byteLength < 500 || ab.byteLength > 8 * 1024 * 1024) return null;
    return { ok: true, name: nameFromUrl(url, ct, cd), type: ct || "application/pdf", dataBase64: abToB64(ab) };
  }
  if (/text\/html/i.test(ct)) {
    const html = await r.text();
    const patterns = [
      /<(?:iframe|embed|object)[^>]+(?:src|data)=["']([^"']+\.(?:pdf|docx?|rtf)[^"']*)["']/i,
      /["'](https?:\/\/[^"']+\.(?:pdf|docx?|rtf)[^"']*)["']/i,
      /["'](https?:\/\/[^"']*(?:downloadcv|cvpreview|filedownload|documentviewer)[^"']*)["']/i,
    ];
    for (const p of patterns) {
      const m = p.exec(html);
      if (m && m[1]) {
        const next = m[1].replace(/&amp;/g, "&");
        const nextAbs = next.startsWith("http") ? next : new URL(next, url).href;
        const got = await fetchDoc(nextAbs, (depth || 0) + 1);
        if (got) return got;
      }
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "fetchDoc") {
    fetchDoc(msg.url, 0)
      .then((f) => sendResponse(f || { ok: false }))
      .catch(() => sendResponse({ ok: false }));
    return true; // async
  }

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
