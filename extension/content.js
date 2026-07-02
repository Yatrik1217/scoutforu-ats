// Injects an "Import to ScoutforU" button on Naukri Resdex profile pages.
// Instead of guessing individual fields with brittle selectors, it grabs the
// candidate panel's TEXT and lets the ATS server run the same AI extractor the
// resume parser uses — reliable regardless of Resdex markup changes. Contact
// details (name/email/phone) are also read directly since they're only visible
// on UNLOCKED profiles.

(function () {
  const BTN_ID = "scoutforu-import-btn";

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

    return { name, rawText };
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
      chrome.runtime.sendMessage({ type: "import", data }, (res) => {
        btn.disabled = false;
        btn.textContent = "➕ Import to ScoutforU";
        if (!res) return toast("Extension not configured — open the popup", false);
        if (!res.ok) return toast(res.error || "Import failed", false);
        if (res.status === "duplicate") return toast(`Already in ATS (${res.existing || data.name})`, true);
        toast(`Imported ${res.name || data.name} to Sourced ✓`, true);
      });
    };
    document.body.appendChild(btn);
  }

  addButton();
  // Resdex is a SPA — re-add the button after navigations.
  new MutationObserver(() => addButton()).observe(document.body, { childList: true, subtree: true });
})();
