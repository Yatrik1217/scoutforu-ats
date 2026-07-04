// Posts the candidate payload to the ScoutforU ATS. To capture the résumé, it
// watches for the NEW TAB that Naukri opens when its "download CV" button is
// clicked (armed just before the click), reads that tab's URL, fetches the file
// — following one "viewer page" hop to an embedded PDF/DOC if needed — then
// closes the tab. Also accepts files/URLs captured in-page by inject.js.

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
const VIEWER_URL = /\.(pdf|docx?|rtf)(\?|#|$)|downloadcv|download-?cv|cvpreview|filedownload|documentviewer|attach-?cv|\/downloadresume|\/cv\/|resume|attachment/i;

// Fetch a URL; return the file if it's a document, else (if HTML) look for an
// embedded file URL and fetch that (one hop).
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
      /["'](https?:\/\/[^"']*(?:downloadcv|cvpreview|filedownload|documentviewer|downloadresume)[^"']*)["']/i,
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

// ---- capture state -----------------------------------------------------------
let armedUntil = 0;
let armedName = ""; // candidate name, used to rename the disk download
let pendingFile = null;
let waiter = null;
const watchedTabs = new Set(); // tabs opened during the armed window
const handledTabs = new Set(); // tabs we've already tried to fetch from

// Rename Naukri's on-disk download (a coded filename) to the candidate name.
if (chrome.downloads && chrome.downloads.onDeterminingFilename) {
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    if (Date.now() > armedUntil || !armedName) { suggest(); return; }
    const cur = item.filename || "";
    let ext = (cur.split(".").pop() || "").toLowerCase();
    if (!/^(pdf|docx?|rtf)$/.test(ext)) {
      ext = /pdf/i.test(item.mime || "") ? "pdf" : /wordprocessingml|docx/i.test(item.mime || "") ? "docx" : /msword/i.test(item.mime || "") ? "doc" : "pdf";
    }
    const safe = armedName.replace(/[^\w .-]+/g, " ").trim() || "resume";
    suggest({ filename: `${safe}.${ext}`, conflictAction: "uniquify" });
  });
}

function storeFile(f) {
  if (!f || Date.now() > armedUntil) return;
  pendingFile = f;
  if (waiter) { const w = waiter; waiter = null; w(f); }
}
function waitForPending(ms) {
  if (pendingFile) { const f = pendingFile; pendingFile = null; return Promise.resolve(f); }
  return new Promise((resolve) => {
    waiter = resolve;
    setTimeout(() => { if (waiter === resolve) { waiter = null; resolve(null); } }, ms);
  });
}

async function tryTab(tabId, url) {
  if (!url || !/^https?:/i.test(url) || handledTabs.has(tabId)) return;
  if (!VIEWER_URL.test(url) && !/naukri|naukimg/i.test(url)) return;
  handledTabs.add(tabId);
  const f = await fetchDoc(url, 0);
  if (f) {
    storeFile(f);
    try { await chrome.tabs.remove(tabId); } catch { /* ignore */ }
  }
}

chrome.tabs.onCreated.addListener((tab) => {
  if (Date.now() > armedUntil) return;
  watchedTabs.add(tab.id);
  if (tab.url) tryTab(tab.id, tab.url);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!watchedTabs.has(tabId)) return;
  const url = changeInfo.url || (tab && tab.url);
  if (url) tryTab(tabId, url);
});

// ---- messages ----------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "arm") {
    armedUntil = Date.now() + 15000;
    armedName = (msg.name || "").toString().slice(0, 80);
    pendingFile = null;
    waiter = null;
    watchedTabs.clear();
    handledTabs.clear();
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "cvBytes") {
    storeFile(msg.file);
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "fetchDoc") {
    fetchDoc(msg.url, 0).then((f) => { if (f) storeFile(f); sendResponse(f || { ok: false }); }).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type !== "import") return;
  chrome.storage.sync.get(["baseUrl", "token"], async (cfg) => {
    if (!cfg.baseUrl || !cfg.token) {
      sendResponse({ ok: false, error: "Set the ATS URL + token in the extension popup" });
      return;
    }
    try {
      const data = { ...msg.data };
      if (!data.resumeFile && msg.expectDownload) {
        const f = await waitForPending(12000);
        if (f) data.resumeFile = f;
      }
      armedUntil = 0;
      const resp = await fetch(cfg.baseUrl.replace(/\/$/, "") + "/api/import-candidate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-token": cfg.token },
        body: JSON.stringify(data),
      });
      const json = await resp.json().catch(() => ({ ok: false, error: "Bad response" }));
      sendResponse(json);
    } catch (e) {
      armedUntil = 0;
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
  return true;
});
