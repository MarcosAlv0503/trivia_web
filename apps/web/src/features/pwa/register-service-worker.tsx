"use client";

import { useEffect } from "react";

/** Registra el service worker (app instalable y avisos push). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    }
  }, []);
  return null;
}
