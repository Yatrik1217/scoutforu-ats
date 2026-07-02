const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(["baseUrl", "token"], (cfg) => {
  $("baseUrl").value = cfg.baseUrl || "https://scoutforu-ats.vercel.app";
  $("token").value = cfg.token || "";
});

$("save").onclick = () => {
  const baseUrl = $("baseUrl").value.trim();
  const token = $("token").value.trim();
  chrome.storage.sync.set({ baseUrl, token }, () => {
    $("status").textContent = "Saved ✓";
    setTimeout(() => ($("status").textContent = ""), 1500);
  });
};
