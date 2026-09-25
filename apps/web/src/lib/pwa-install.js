import { useEffect, useState } from "react";
import baseUrl from "./baseurl";

let deferredPrompt = null;
let installed = false;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isIos() {
  const ua = window.navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function registerAppWorker() {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(`${baseUrl}/sw.js`, { scope: `${baseUrl}/` }).catch(() => undefined);
}

export function initPwaInstall() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
  if (document.readyState === "complete") registerAppWorker();
  else window.addEventListener("load", registerAppWorker, { once: true });
}

export function useInstallPrompt() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((tick) => tick + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  const standalone = installed || isStandalone();
  const iosManual = !standalone && !deferredPrompt && isIos() && window.isSecureContext;
  return {
    canInstall: !standalone && Boolean(deferredPrompt),
    iosManual,
    async install() {
      if (!deferredPrompt) return false;
      const prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      notify();
      return choice?.outcome === "accepted";
    },
  };
}
