"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SiteI18n } from "./site-i18n";
import type { Dictionary } from "@/lib/i18n/translate";
import { loadPreview } from "@/lib/preview-loader";

const loaded = new Map<string, Dictionary>();

export function PreviewI18n({ locale, slug, url, loadingLabel, retryLabel, children }: { locale: string; slug: string; url?: string; loadingLabel: string; retryLabel: string; children: ReactNode }) {
  const [dictionary, setDictionary] = useState<Dictionary | null>(() => !url ? {} : loaded.get(url) ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    loadPreview(slug);
    if (!url) { setDictionary({}); return; }
    const controller = new AbortController();
    setFailed(false);
    fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) }).then(async (response) => {
      if (!response.ok) throw new Error("Language edition unavailable");
      const copy = await response.json() as Dictionary;
      loaded.set(url, copy);
      setDictionary(copy);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [url, slug, attempt]);
  if (!dictionary) return <div data-preview-slug={slug} data-preview-ready="false" className="flex min-h-dvh items-center justify-center" role="status" aria-label={loadingLabel}>{failed ? <button type="button" className="rounded-lg border border-current/20 px-4 py-3 text-sm" onClick={() => setAttempt((value) => value + 1)}>{retryLabel} ↻</button> : <span className="size-5 animate-spin rounded-full border-2 border-current/10 border-t-current/50" />}</div>;
  return <SiteI18n locale={locale} dictionary={dictionary}>{children}</SiteI18n>;
}
