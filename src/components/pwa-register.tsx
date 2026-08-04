"use client";

import { useEffect } from "react";

// Registers the service worker so the ATS is installable as a home-screen app.
export function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
