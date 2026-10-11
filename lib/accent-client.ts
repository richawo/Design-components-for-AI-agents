"use client";
import { useSyncExternalStore } from "react";
import { ACCENT_KEY, parseAccent } from "./accent";
const EVENT = "dfa-accent-change";
let current: string | null | undefined;
export function readAccent(): string | null {
  if (current !== undefined) return current;
  try { current = parseAccent(localStorage.getItem(ACCENT_KEY)); } catch { current = null; }
  return current;
}
// This preference belongs to component demos. Never rewrite the site's theme.
export function setAccent(value: string | null) {
  current = parseAccent(value);
  try { if (current) localStorage.setItem(ACCENT_KEY, current); else localStorage.removeItem(ACCENT_KEY); } catch { /* Private browsing still supports a session choice. */ }
  window.dispatchEvent(new Event(EVENT));
  // Storage can be unavailable. Explicitly notify embedded previews as well.
  for (const frame of document.querySelectorAll('iframe[src^="/preview/"]')) {
    (frame as HTMLIFrameElement).contentWindow?.postMessage({ channel: EVENT, accent: current }, window.location.origin);
  }
}
function subscribe(listener: () => void) {
  const changed = () => listener();
  const storage = (event: StorageEvent) => {
    if (event.key !== ACCENT_KEY && event.key !== null) return;
    current = parseAccent(event.newValue);
    changed();
  };
  const message = (event: MessageEvent) => {
    if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin || event.data?.channel !== EVENT) return;
    current = parseAccent(event.data.accent);
    changed();
  };
  window.addEventListener(EVENT, changed);
  window.addEventListener("storage", storage);
  window.addEventListener("message", message);
  return () => {
    window.removeEventListener(EVENT, changed);
    window.removeEventListener("storage", storage);
    window.removeEventListener("message", message);
  };
}
const serverSnapshot = () => null;
export function useAccent() { return useSyncExternalStore(subscribe, readAccent, serverSnapshot); }
