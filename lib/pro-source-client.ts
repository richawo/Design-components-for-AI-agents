"use client";

export type SourcePayload = {
  code: string;
  codeHtml: string;
  prompt: string;
  promptJson: string;
  promptJsonHtml: string;
};

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
        const data = r.ok ? ((await r.json()) as SourcePayload | { locked: true }) : null;
        return !data || "locked" in data ? null : data;
      })
      .catch(() => null);
    cache.set(slug, p);
    // A failure shouldn't stick for the life of the page.
    p.then((v) => v === null && cache.delete(slug));
  }
  return p;
}
