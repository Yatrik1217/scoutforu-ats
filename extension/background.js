// Receives scraped candidate data from the content script, captures the
// candidate's résumé via Naukri's own "download CV" button (through the
// chrome.downloads API), and POSTs everything to the ScoutforU ATS import
// endpoint. The disk download is cancelled/erased after we grab the bytes.

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
  let fn = ((url || "").split("#")[0].split("?")[0].split("/").pop() || "resume").slice(0, 80);
  if (!/\.(pdf|docx?|rtf)$/i.test(fn)) {
    const ext =
      /pdf/i.test(type) ? "pdf" :
      /wordprocessingml|docx/i.test(type) ? "docx" :
      /msword/i.test(type) ? "doc" : "pdf";
    fn = (fn.replace(/[^\w.-]+/g, "_") || "resume") + "." + ext;
  }
  return fn;
}

// ---- Download capture --------------------------------------------------------
const armState = { armed: false, until: 0 };
let captureResolve = null; // resolver for an in-flight waitForDownload
let lastFile = null; // download captured before the waiter was ready

chrome.downloads.onCreated.addListener(async (item) => {
  if (!armState.armed || Date.now() > armState.until) return;
  const url = item.finalUrl || item.url || "";
  // Stop the file from actually landing in the user's Downloads folder.
  try { await chrome.downloads.cancel(item.id); } catch { /* may already be done */ }
  try { await chrome.downloads.erase({ id: item.id }); } catch { /* ignore */ }
  try {
    if (!url || /^blob:/i.test(url) || /^data:/i.test(url)) return; // not refetchable
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) return;
    const type = item.mime || r.headers.get("content-type") || "application/pdf";
    if (/text\/html/i.test(type)) return; // a viewer page, not the file
    const ab = await r.arrayBuffer();
    if (ab.byteLength < 500 || ab.byteLength > 7 * 1024 * 1024) return;
    const file = {
      name: nameFromUrl(item.filename || url, type),
      type: type || "application/pdf",
      dataBase64: abToB64(ab),
    };
    if (captureResolve) {
      const done = captureResolve;
      captureResolve = null;
      done(file);
    } else {
      lastFile = file;
    }
  } catch {
    /* capture failed — import proceeds without a file */
  }
});

function waitForDownload(ms) {
  if (lastFile) {
    const f = lastFile;
    lastFile = null;
    return Promise.resolve(f);
  }
  return new Promise((resolve) => {
    captureResolve = resolve;
    setTimeout(() => {
      if (captureResolve === resolve) {
        captureResolve = null;
        resolve(null);
      }
    }, ms);
  });
}

// ---- Messages ----------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "arm") {
    armState.armed = true;
    armState.until = Date.now() + 12000;
    lastFile = null;
    captureResolve = null;
    sendResponse({ ok: true });
    return; // sync response
  }

  if (msg.type !== "import") return;
  chrome.storage.sync.get(["baseUrl", "token"], async (cfg) => {
    if (!cfg.baseUrl || !cfg.token) {
      sendResponse({ ok: false, error: "Set the ATS URL + token in the extension popup" });
      return;
    }
    try {
      const data = { ...msg.data };
      delete data.resumeUrls;

      let resumeFile = null;
      if (msg.expectDownload) {
        resumeFile = await waitForDownload(10000);
      }
      armState.armed = false;
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
      armState.armed = false;
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
  return true; // async response
});
