// Runs in the PAGE's own JS context (manifest world: "MAIN", document_start).
// Naukri produces the résumé file via a network request / blob at download time;
// this hooks fetch, XMLHttpRequest, URL.createObjectURL and résumé link clicks
// to capture that file the instant it's produced, then hands it to the isolated
// content script via window.postMessage. This is how in-page CV grabbers work —
// a background worker can't re-fetch a blob download after the fact.

(function () {
  if (window.__scoutforuHooked) return;
  window.__scoutforuHooked = true;

  const DOC_CT = /(pdf|msword|officedocument|wordprocessingml|rtf|application\/octet-stream)/i;
  const DOC_URL = /\.(pdf|docx?|rtf)(\?|#|$)|download|resume|cv|attach|filedownload/i;

  function b64(ab) {
    const bytes = new Uint8Array(ab);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
  }

  function fileName(url, type, cd) {
    let fn = "";
    if (cd) {
      const m = /filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)/i.exec(cd);
      if (m) { try { fn = decodeURIComponent(m[1]); } catch { fn = m[1]; } }
    }
    if (!fn) fn = (String(url).split("#")[0].split("?")[0].split("/").pop() || "resume").slice(0, 80);
    if (!/\.(pdf|docx?|rtf)$/i.test(fn)) {
      const ext = /pdf/i.test(type) ? "pdf" : /wordprocessingml|docx/i.test(type) ? "docx" : /msword/i.test(type) ? "doc" : "pdf";
      fn = (fn.replace(/[^\w.-]+/g, "_") || "resume") + "." + ext;
    }
    return fn;
  }

  function send(url, type, cd, ab) {
    try {
      if (!ab || ab.byteLength < 500 || ab.byteLength > 8 * 1024 * 1024) return;
      // Skip HTML masquerading as a doc.
      const head = new Uint8Array(ab.slice(0, 5));
      const isHtml = head[0] === 0x3c && (head[1] === 0x21 || head[1] === 0x68 || head[1] === 0x48); // <! or <h/<H
      if (isHtml && !/pdf/i.test(type)) return;
      window.postMessage(
        { __scoutforu_cv: true, name: fileName(url, type, cd), type: type || "application/pdf", dataBase64: b64(ab) },
        "*",
      );
    } catch { /* ignore */ }
  }

  const looksDoc = (url, ct) => (DOC_CT.test(ct) || (DOC_URL.test(url) && !/text\/html/i.test(ct)));

  // fetch
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (...args) {
      return origFetch.apply(this, args).then((res) => {
        try {
          const url = (res && res.url) || String(args[0] || "");
          const ct = (res.headers && res.headers.get("content-type")) || "";
          if (looksDoc(url, ct)) {
            const cd = (res.headers && res.headers.get("content-disposition")) || "";
            res.clone().arrayBuffer().then((ab) => send(url, ct, cd, ab)).catch(() => {});
          }
        } catch { /* ignore */ }
        return res;
      });
    };
  }

  // XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (_m, url) {
    this.__sfuUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      try {
        const ct = (this.getResponseHeader && this.getResponseHeader("content-type")) || "";
        const url = this.__sfuUrl || "";
        if (!looksDoc(url, ct)) return;
        const cd = (this.getResponseHeader && this.getResponseHeader("content-disposition")) || "";
        const r = this.response;
        if (r instanceof ArrayBuffer) send(url, ct, cd, r);
        else if (r instanceof Blob) r.arrayBuffer().then((ab) => send(url, ct, cd, ab)).catch(() => {});
      } catch { /* ignore */ }
    });
    return origSend.apply(this, arguments);
  };

  // Blob downloads via URL.createObjectURL(blob)
  const origCreate = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    try {
      if (obj instanceof Blob && DOC_CT.test(obj.type || "")) {
        obj.arrayBuffer().then((ab) => send("resume", obj.type, "", ab)).catch(() => {});
      }
    } catch { /* ignore */ }
    return origCreate.apply(this, arguments);
  };

  // A résumé/CV URL that may be same-origin or on a Naukri CDN — hand it to the
  // background worker to fetch (it can follow cross-origin + one viewer hop).
  const DOC_OR_VIEWER = /\.(pdf|docx?|rtf)(\?|#|$)|cvpreview|viewcv|download-?cv|downloadcv|filedownload|documentviewer|attach-?cv|attachedcv|\/cv\/|resume|attachment/i;
  function relay(url) {
    try {
      if (url && /^https?:/i.test(url)) window.postMessage({ __scoutforu_docurl: true, url: String(url) }, "*");
    } catch { /* ignore */ }
  }

  // The CV often opens in a NEW TAB via window.open — capture that URL and
  // suppress the popup (we fetch the file ourselves).
  const origWinOpen = window.open;
  window.open = function (url) {
    try {
      const u = String(url || "");
      if (u && DOC_OR_VIEWER.test(u)) {
        relay(u);
        return { closed: false, focus() {}, close() {}, blur() {}, document: {} };
      }
    } catch { /* ignore */ }
    return origWinOpen.apply(this, arguments);
  };

  // Direct <a href> / download / new-tab link clicks.
  document.addEventListener(
    "click",
    function (e) {
      try {
        const a = e.target && e.target.closest && e.target.closest("a[href]");
        if (!a) return;
        const href = a.href || "";
        if (a.hasAttribute("download") || DOC_OR_VIEWER.test(href)) relay(href);
      } catch { /* ignore */ }
    },
    true,
  );
})();
