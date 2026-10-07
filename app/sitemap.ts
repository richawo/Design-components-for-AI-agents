import type { MetadataRoute } from "next";
import { allDocs, allPosts } from "@/lib/content";
import { allComponents, categoriesWithCounts, thumbnailFor } from "@/lib/registry";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const components = allComponents();
  const latest = components.map((c) => c.added).sort().at(-1) ?? "2026-10-07";
  const posts = allPosts();
  return [
    { url: absoluteUrl("/"), lastModified: latest, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/components"), lastModified: latest, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/pricing"), changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/blog"), lastModified: posts[0]?.dateModified, changeFrequency: "weekly", priority: 0.7 },
    ...categoriesWithCounts().map((c) => ({ url: absoluteUrl(`/categories/${c.key}`), lastModified: latest, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...components.map((c) => {
      const thumb = thumbnailFor(c.slug);
      return {
        url: absoluteUrl(`/components/${c.slug}`),
        lastModified: c.added,
        changeFrequency: "monthly" as const,
        priority: 0.8,
        images: thumb ? [absoluteUrl(thumb)] : undefined,
      };
    }),
    ...posts.map((p) => ({ url: absoluteUrl(`/blog/${p.slug}`), lastModified: p.dateModified, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...allDocs().map((d) => ({ url: absoluteUrl(d.slug === "introduction" ? "/docs" : `/docs/${d.slug}`), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
