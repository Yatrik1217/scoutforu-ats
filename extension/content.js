// Injects an "Import to ScoutforU" button on Naukri Resdex profile pages.
// Instead of guessing individual fields with brittle selectors, it grabs the
// candidate panel's TEXT and lets the ATS server run the same AI extractor the
// resume parser uses — reliable regardless of Resdex markup changes. Contact
// details (name/email/phone) are also read directly since they're only visible
// on UNLOCKED profiles.

(function () {
  const BTN_ID = "scoutforu-import-btn";

  // Grab the largest sensible profile container's text, falling back to body.
  function profileText() {
    const sel = [
      "[class*='profileCard' i]",
      "[class*='candidate' i]",
      "[class*='resdexProfile' i]",
      "[class*='profile-detail' i]",
      "main",
      "#root",
    ];
    let best = "";
    for (const s of sel) {
      for (const el of document.querySelectorAll(s)) {
        const t = (el.innerText || "").trim();
        if (t.length > best.length) best = t;
      }
    }
    const body = (document.body.innerText || "").trim();
    // Prefer a focused container, but if nothing beat ~200 chars use the body.
    const text = best.length > 200 ? best : body;
    return text.replace(/\n{3,}/g, "\n\n").slice(0, 15000);
  }

  function scrape() {
    const text = document.body.innerText || "";
    const email = (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [""])[0];
    const phoneM = text.match(/(?:\+?91[-\s]?)?[6-9]\d{9}/);
    const phone = phoneM ? phoneM[0] : "";

    // Name: prefer a prominent heading, fall back to document title.
    const heading = document.querySelector("h1, h2, [class*='name' i]");
    let name = heading ? heading.textContent.trim() : "";
    if (!name || name.length > 60) name = (document.title || "").split(/[-|]/)[0].trim();

    // Only send fields we can read reliably; everything else (experience, CTC,
    // location, skills, education …) is extracted server-side from rawText.
    return { name, email, phone, rawText: profileText() };
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
