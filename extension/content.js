// Injects an "Import to ScoutforU" button on Naukri Resdex profile pages,
// scrapes the visible candidate details, and sends them to the ATS via the
// background worker. Resdex only shows contact details on UNLOCKED profiles —
// the scraper can only capture what is visible on screen.

(function () {
  const BTN_ID = "scoutforu-import-btn";

  function scrape() {
    const text = document.body.innerText || "";
    const email = (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [""])[0];
    // Indian mobile: optional +91, 10 digits starting 6-9
    const phoneM = text.match(/(?:\+?91[-\s]?)?[6-9]\d{9}/);
    const phone = phoneM ? phoneM[0] : "";

    // Name: prefer a prominent heading, fall back to document title
    const heading =
      document.querySelector("h1, h2, [class*='name' i], [class*='Name']");
    let name = heading ? heading.textContent.trim() : "";
    if (!name || name.length > 60) name = (document.title || "").split(/[-|]/)[0].trim();

    // Best-effort extras via labels in the page text
    const grab = (label) => {
      const re = new RegExp(label + "\\s*[:\\-]?\\s*([^\\n]{1,60})", "i");
      const m = text.match(re);
      return m ? m[1].trim() : "";
    };

    return {
      name,
      email,
      phone,
      location: grab("current location|location"),
      currentDesignation: grab("current designation|designation"),
      currentCompany: grab("current company|company"),
      expYears: parseFloat((grab("total experience|experience").match(/\d+(\.\d+)?/) || [0])[0]) || 0,
      currentCtc: parseFloat((grab("current ctc|annual salary").match(/\d+(\.\d+)?/) || [0])[0]) || 0,
      skills: (grab("key skills|skills") || "")
        .split(/[,;]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 25),
    };
  }

  function toast(msg, ok) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
      "background:" + (ok ? "#0E1320" : "#dc2626") + ";color:#fff;padding:12px 18px;border-radius:12px;" +
      "font:600 13px system-ui;box-shadow:0 12px 32px rgba(0,0,0,.35)";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
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
        toast(`Imported ${data.name} to Sourced ✓`, true);
      });
    };
    document.body.appendChild(btn);
  }

  addButton();
  // Resdex is a SPA — re-add the button after navigations
  new MutationObserver(() => addButton()).observe(document.body, { childList: true, subtree: true });
})();
