// Minimal service worker — its presence + a fetch handler make the app
// installable (Add to Home Screen) without caching authenticated data (which
// would risk showing stale candidate info). Requests just pass through to the
// network. Bump the version to force an update.
const VERSION = "scoutforu-ats-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  /* pass-through: let the browser handle every request over the network */
});
