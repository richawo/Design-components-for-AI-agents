"use client";
import { useSyncExternalStore } from "react";
import { ACCENT_KEY, DEFAULT_ACCENT, accentInk, accentText, parseAccent } from "./accent";
const EVENT = "dfa-accent-change";
let current: string | null | undefined;
export function readAccent(): string | null {
  if (current !== undefined) return current;
  try { current = parseAccent(localStorage.getItem(ACCENT_KEY)); } catch { current = null; }
  return current;
}
function applyAccent(value: string | null) {
  const root = document.documentElement;
  const hex = value ?? DEFAULT_ACCENT;
  root.style.setProperty("--color-site-accent", hex);
  root.style.setProperty("--color-site-on-accent", accentInk(hex));
  root.style.setProperty("--color-site-accent-readable", accentText(hex));
}
export function setAccent(value: string | null) {
  current = parseAccent(value);
  applyAccent(current);
  try { if (current) localStorage.setItem(ACCENT_KEY, current); else localStorage.removeItem(ACCENT_KEY); } catch { /* Private browsing still supports a session choice. */ }
  window.dispatchEvent(new Event(EVENT));
  // Storage can be unavailable. Explicitly notify embedded previews as well.
  for (const frame of document.querySelectorAll('iframe[src^="/preview/"]')) {
    (frame as HTMLIFrameElement).contentWindow?.postMessage({ channel: EVENT, accent: current }, window.location.origin);
  }
}
function subscribe(listener: () => void) {
  const changed = () => { applyAccent(readAccent()); listener(); };
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
  applyAccent(readAccent());
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
