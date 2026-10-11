"use client";

export type SourcePayload = {
  code: string;
  codeHtml: string;
  prompt: string;
  promptJson: string;
  promptJsonHtml: string;
};

export class SourceLoadError extends Error {
  constructor() { super("The component source could not be loaded."); }
}

const cache = new Map<string, Promise<SourcePayload | null>>();

/**
 * A Pro component's source for the signed-in visitor, or null when they have
 * no licence. The server checks the licence (/api/pro/source); this only makes
 * sure the page asks once, however many panels need it.
 */
export function fetchProSource(slug: string): Promise<SourcePayload | null> {
  let p = cache.get(slug);
  if (!p) {
    p = fetch(`/api/pro/source/${slug}`, { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) return null;
        if (!r.ok) throw new SourceLoadError();
        const data: unknown = await r.json();
        if (data && typeof data === "object" && "locked" in data && data.locked === true) return null;
        const fields = ["code", "codeHtml", "prompt", "promptJson", "promptJsonHtml"] as const;
        if (!data || typeof data !== "object" || !fields.every((field) => field in data && typeof (data as Record<string, unknown>)[field] === "string")) throw new SourceLoadError();
        return data as SourcePayload;
      }).catch(() => { throw new SourceLoadError(); });
    cache.set(slug, p);
    // A failure shouldn't stick for the life of the page.
    const request = p;
    const clear = () => { if (cache.get(slug) === request) cache.delete(slug); };
    p.then((v) => { if (v === null) clear(); }, clear);
  }
  return p;
}
