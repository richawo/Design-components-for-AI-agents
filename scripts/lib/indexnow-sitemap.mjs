// Dependency-free so the manual IndexNow workflow can run without installing
// the website. Sitemap indexes contain sitemap URLs, not pages to submit.
function decodeXml(value) {
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity, name) => {
    if (name.startsWith("#")) {
      return String.fromCodePoint(name[1].toLowerCase() === "x"
        ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[name.toLowerCase()];
  });
}

export async function collectSitemapUrls(sitemapUrl, fetchImpl = fetch) {
  const origin = new URL(sitemapUrl).origin;
  const pending = [sitemapUrl];
  const visited = new Set();
  const pages = new Set();

  while (pending.length) {
    const url = pending.shift();
    if (visited.has(url)) continue;
    if (new URL(url).origin !== origin) throw new Error(`Off-site sitemap: ${url}`);
    if (visited.size >= 1000) throw new Error("Too many sitemap files");
    visited.add(url);
    const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Sitemap fetch failed: ${response.status} ${url}`);
    const xml = await response.text();
    const locations = [...xml.matchAll(/<loc\b[^>]*>\s*([^<]+?)\s*<\/loc>/g)]
      .map((match) => new URL(decodeXml(match[1].trim())).toString());
    if (/<sitemapindex\b/.test(xml)) {
      pending.push(...locations);
    } else if (/<urlset\b/.test(xml)) {
      for (const location of locations) {
        if (new URL(location).origin !== origin) throw new Error(`Off-site page: ${location}`);
        pages.add(location);
      }
    } else {
      throw new Error(`Expected sitemap index or URL set: ${url}`);
    }
  }
  return [...pages];
}
