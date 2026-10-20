import { previews } from "@/registry/__generated__/previews";

const pending = new Map<string, ReturnType<(typeof previews)[string]>>();

/** Share the one selected import between language loading and the renderer. */
export function loadPreview(slug: string) {
  if (!Object.hasOwn(previews, slug)) return undefined;
  let request = pending.get(slug);
  if (!request) {
    request = previews[slug]();
    pending.set(slug, request);
    request.catch(() => { pending.delete(slug); });
  }
  return request;
}

// Start while the preview document's client modules initialise, before React
// effects and its selected language file. Catalogue pages load no demo code.
if (typeof window !== "undefined") {
  const slug = /(?:^|\/)preview\/([^/]+)$/.exec(window.location.pathname)?.[1];
  if (slug) loadPreview(slug);
}
