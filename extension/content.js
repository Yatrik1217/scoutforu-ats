// Injects an "Import to ScoutforU" button on Naukri Resdex profile pages.
// Instead of guessing individual fields with brittle selectors, it grabs the
// candidate panel's TEXT and lets the ATS server run the same AI extractor the
// resume parser uses — reliable regardless of Resdex markup changes. Contact
// details (name/email/phone) are also read directly since they're only visible
// on UNLOCKED profiles.

(function () {
  const BTN_ID = "scoutforu-import-btn";

  // The in-page interceptor (inject.js) posts the captured résumé file — or a
  // résumé/viewer URL for the background worker to fetch — here. This runs in
  // BOTH the profile tab and any CV-viewer tab Naukri opens, so files captured
  // in the viewer tab are forwarded to the background for the import to use.
  let capturedCv = null;
  let lastDocUrl = "";
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d) return;
    if (d.__scoutforu_cv && d.dataBase64) {
      capturedCv = { name: d.name, type: d.type, dataBase64: d.dataBase64 };
      try { chrome.runtime.sendMessage({ type: "cvBytes", file: capturedCv }); } catch { /* ignore */ }
    } else if (d.__scoutforu_docurl && d.url) {
      lastDocUrl = d.url;
      try { chrome.runtime.sendMessage({ type: "fetchDoc", url: d.url }); } catch { /* ignore */ }
    }
  });

  // In a CV-viewer tab, the résumé may be an embedded PDF (iframe/embed/object)
  // rather than a JS fetch — relay those src URLs to the background to fetch.
  function relayEmbeddedDocs() {
    try {
      document.querySelectorAll("iframe[src], embed[src], object[data], a[href]").forEach((el) => {
        const u = el.src || el.data || el.href || "";
        if (/\.(pdf|docx?|rtf)(\?|#|$)|downloadcv|filedownload|documentviewer|downloadresume/i.test(u)) {
          try { chrome.runtime.sendMessage({ type: "fetchDoc", url: u }); } catch { /* ignore */ }
        }
      });
    } catch { /* ignore */ }
  }
  // Viewer tabs load async — scan a few times.
  [800, 2000, 4000].forEach((t) => setTimeout(relayEmbeddedDocs, t));

  // Read an element's visible text safely — some framework elements throw or
  // return non-strings when innerText is accessed.
  function textOf(el) {
    try {
      const t = el && el.innerText;
      if (typeof t === "string") return t.trim();
      const tc = el && el.textContent;
      return typeof tc === "string" ? tc.trim() : "";
    } catch {
      return "";
    }
  }

  // Grab the largest sensible profile container's text, falling back to body.
  function profileText() {
    let best = "";
    try {
      const sel = [
        "[class*='profileCard' i]",
        "[class*='candidate' i]",
        "[class*='resdexProfile' i]",
        "[class*='profile-detail' i]",
        "[class*='profile' i]",
        "main",
        "#root",
      ];
      for (const s of sel) {
        let nodes = [];
        try { nodes = document.querySelectorAll(s); } catch { nodes = []; }
        for (const el of nodes) {
          const t = textOf(el);
          if (t.length > best.length) best = t;
        }
      }
    } catch {
      /* ignore — fall back to body below */
    }
    const body = textOf(document.body);
    // Prefer a focused container, but if nothing beat ~200 chars use the body.
    const text = (best.length > 200 ? best : body) || body || "";
    return text.replace(/\n{3,}/g, "\n\n").slice(0, 15000);
  }

  // Click Resdex's own "download CV" control. The original résumé is not a
  // fetchable URL — it's produced by this button's JS. The background worker
  // (armed just before) captures the resulting download.
  function clickCvDownload() {
    const sels = [
      "i.naukri-icon-file_download",
      "i.naukri-btn-icon.naukri-icon-download",
      "i.naukri-icon-download",
      "[title*='download cv' i]",
      "[aria-label*='download cv' i]",
      "[class*='downloadCv' i]",
      "[class*='download-cv' i]",
    ];
    for (const sel of sels) {
      let el;
      try { el = document.querySelector(sel); } catch { el = null; }
      if (!el) continue;
      const target = el.closest("a,button,[role='button'],[onclick]") || el;
      try {
        target.click();
        return true;
      } catch {
        /* try next */
      }
    }
    return false;
  }

  // The CV is rendered as HTML on the page (cv-educ, cv-prev-*, etc.). Capture
  // that section as a standalone HTML document so a résumé file is always
  // attached, even when the original file download can't be captured.
  function captureCvHtml(name) {
    try {
      const anchor = document.querySelector(
        "[class*='cv-prev'],[class*='cv-educ'],[class*='cv-emp'],[class*='cvPreview' i],[class*='cv-']",
      );
      let el = anchor;
      if (el) {
        for (let i = 0; i < 6 && el.parentElement; i++) {
          el = el.parentElement;
          if ((el.innerText || "").length > 900) break;
        }
      } else {
        el = document.querySelector("main, #root") || document.body;
      }
      const clone = el.cloneNode(true);
      clone
        .querySelectorAll("script,style,noscript,svg,button,input,iframe,[class*='action' i],[class*='sim' i],[class*='btn' i]")
        .forEach((n) => n.remove());
      const inner = clone.innerHTML || "";
      if (inner.length < 400) return "";
      const safeName = (name || "Candidate").replace(/[<>&]/g, "");
      return (
        "<!doctype html><html><head><meta charset='utf-8'><title>" +
        safeName +
        " — CV</title><style>body{font:14px/1.55 system-ui,Arial,sans-serif;max-width:820px;margin:24px auto;padding:0 18px;color:#16203a}h1,h2,h3{margin:.7em 0 .25em}*{max-width:100%}table{border-collapse:collapse}td,th{padding:2px 8px}</style></head><body><h2>" +
        safeName +
        "</h2>" +
        inner +
        "</body></html>"
      );
    } catch {
      return "";
    }
  }

  function scrape() {
    // We deliberately do NOT regex-scrape email/phone here: a blind page scan
    // grabs shared page-chrome values (the recruiter's own inbox, a Naukri
    // support number) that are identical on every profile and cause false
    // "already in ATS" duplicates. Instead we send the profile text and let the
    // server's AI extractor pull the *candidate's* own contact details.
    const rawText = profileText();

    // Name: prefer a prominent heading, fall back to document title.
    let name = "";
    try {
      const heading = document.querySelector("h1, h2, [class*='name' i]");
      name = textOf(heading);
    } catch {
      /* ignore */
    }
    if (!name || name.length > 60) name = (document.title || "").split(/[-|]/)[0].trim();

    return { name, rawText, cvHtml: captureCvHtml(name) };
  }

  function toast(msg, ok) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
      "background:" + (ok ? "#0E1320" : "#dc2626") + ";color:#fff;padding:12px 18px;border-radius:12px;" +
      "font:600 13px system-ui;box-shadow:0 12px 32px rgba(0,0,0,.35)";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // Diagnostic: gather everything on the page that could be the résumé file, so
  // the résumé finder can be tuned to this Resdex layout. Rendered on-page (no
  // console needed) — the recruiter screenshots or copies it.
  function collectDiag() {
    const d = { url: location.href, iframes: [], embeds: [], links: [], resumeish: [] };
    try {
      document.querySelectorAll("iframe").forEach((f) => d.iframes.push(f.src || "(no src)"));
      document.querySelectorAll("embed,object").forEach((e) => d.embeds.push(e.src || e.data || "(no src)"));
      document.querySelectorAll("a[href]").forEach((a) => {
        const h = a.href || "";
        if (/\.(pdf|docx?|rtf)|resume|cv|download|attach/i.test(h + " " + (a.textContent || "")))
          d.links.push(((a.textContent || "").trim().slice(0, 30) || "(link)") + " -> " + h);
      });
      document
        .querySelectorAll("[class*='resume' i],[class*='cv' i],[class*='attach' i],[class*='download' i],[id*='resume' i],[data-testid*='resume' i]")
        .forEach((el) => {
          d.resumeish.push(
            el.tagName.toLowerCase() +
              " ." + (el.className || "").toString().replace(/\s+/g, ".").slice(0, 50) +
              "  “" + (el.innerText || "").trim().slice(0, 30) + "”",
          );
        });
    } catch (e) {
      d.error = String(e && e.message);
    }
    return d;
  }

  function showDebug() {
    document.getElementById("scoutforu-diag")?.remove();
    const d = collectDiag();
    const text =
      "URL:\n" + d.url + "\n\n" +
      "LAST CV/VIEWER URL CAPTURED (click Naukri's download first):\n" + (lastDocUrl || "(none yet)") + "\n\n" +
      "IFRAMES (" + d.iframes.length + "):\n" + (d.iframes.join("\n") || "(none)") + "\n\n" +
      "EMBED/OBJECT (" + d.embeds.length + "):\n" + (d.embeds.join("\n") || "(none)") + "\n\n" +
      "RESUME-ish LINKS (" + d.links.length + "):\n" + (d.links.join("\n") || "(none)") + "\n\n" +
      "RESUME-ish ELEMENTS (" + d.resumeish.length + "):\n" + (d.resumeish.join("\n") || "(none)");
    const box = document.createElement("div");
    box.id = "scoutforu-diag";
    box.style.cssText =
      "position:fixed;top:20px;left:20px;right:20px;bottom:20px;z-index:2147483647;background:#0E1320;" +
      "color:#dbe4f5;border-radius:14px;padding:16px 18px;box-shadow:0 20px 60px rgba(0,0,0,.6);" +
      "display:flex;flex-direction:column;gap:10px";
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:8px;align-items:center";
    bar.innerHTML = "<b style='flex:1;font:700 14px system-ui'>ScoutforU — résumé diagnostic (screenshot or copy this)</b>";
    const copy = document.createElement("button");
    copy.textContent = "Copy";
    copy.style.cssText = "background:#2a6fdb;color:#fff;border:none;padding:7px 14px;border-radius:8px;font:700 12px system-ui;cursor:pointer";
    copy.onclick = () => { navigator.clipboard.writeText(text).then(() => (copy.textContent = "Copied ✓")); };
    const close = document.createElement("button");
    close.textContent = "Close";
    close.style.cssText = "background:#31405e;color:#fff;border:none;padding:7px 14px;border-radius:8px;font:700 12px system-ui;cursor:pointer";
    close.onclick = () => box.remove();
    bar.appendChild(copy); bar.appendChild(close);
    const pre = document.createElement("pre");
    pre.textContent = text;
    pre.style.cssText = "flex:1;overflow:auto;margin:0;white-space:pre-wrap;word-break:break-all;font:12px ui-monospace,Menlo,monospace;background:#070a12;padding:12px;border-radius:8px";
    box.appendChild(bar); box.appendChild(pre);
    document.body.appendChild(box);
  }

  function addButton() {
    if (document.getElementById(BTN_ID)) return;
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "➕ Import to ScoutforU";
    btn.style.cssText =
      "position:fixed;top:90px;right:20px;z-index:2147483647;background:#2a6fdb;color:#fff;" +
      "border:none;padding:11px 16px;border-radius:10px;font:700 13px system-ui;cursor:pointer;" +
      "box-shadow:0 4px 14px rgba(42,111,219,.45)";
    btn.onclick = () => {
      const data = scrape();
      if (!data.name) return toast("Couldn't find a candidate name on this page", false);
      btn.disabled = true;
      btn.textContent = "Importing…";
      const finish = (res) => {
        btn.disabled = false;
        btn.textContent = "➕ Import to ScoutforU";
        if (!res) return toast("Extension not configured — open the popup", false);
        if (!res.ok) return toast(res.error || "Import failed", false);
        if (res.status === "duplicate") return toast(`Already in ATS (${res.existing || data.name})`, true);
        toast(`Imported ${res.name || data.name}${res.resume ? " + resume" : ""} to Sourced ✓`, true);
      };
      // Arm the background capture, click Naukri's own CV download (which opens
      // the file/viewer in a new tab), and let the background worker grab the
      // file from that tab. The server falls back to the clean HTML CV snapshot
      // if nothing is captured.
      capturedCv = null;
      chrome.runtime.sendMessage({ type: "arm" }, () => {
        const clicked = clickCvDownload();
        if (clicked) btn.textContent = "Grabbing CV…";
        if (capturedCv) data.resumeFile = capturedCv;
        chrome.runtime.sendMessage({ type: "import", data, expectDownload: clicked }, finish);
      });
    };
    document.body.appendChild(btn);

    // Small "CV debug" helper button beneath the import button.
    const dbg = document.createElement("button");
    dbg.id = "scoutforu-debug-btn";
    dbg.textContent = "🔍 CV debug";
    dbg.title = "Show what résumé files this page exposes";
    dbg.style.cssText =
      "position:fixed;top:134px;right:20px;z-index:2147483647;background:#31405e;color:#fff;" +
      "border:none;padding:7px 12px;border-radius:9px;font:700 11px system-ui;cursor:pointer;" +
      "box-shadow:0 3px 10px rgba(0,0,0,.35)";
    dbg.onclick = showDebug;
    document.body.appendChild(dbg);
  }

  addButton();
  // Resdex is a SPA — re-add the button after navigations.
  new MutationObserver(() => addButton()).observe(document.body, { childList: true, subtree: true });
})();
