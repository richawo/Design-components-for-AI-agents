import fs from "node:fs";
import { expect, it } from "vitest";
import { componentGuide, guideMarkdown } from "@/lib/component-guidance";
import index from "@/registry/__generated__/index.json";

it("gives every published component distinct, public selection guidance and valid related links", () => {
  const known = new Set(index.map((entry) => entry.slug));
  const purposes = new Set<string>();
  for (const entry of index) {
    const guide = componentGuide(entry.slug);
    expect(guide.useWhen.length, entry.slug).toBeGreaterThan(35);
    expect(guide.avoidWhen.length, entry.slug).toBeGreaterThan(35);
    expect(guide.integration.length, entry.slug).toBeGreaterThan(0);
    expect(purposes.has(guide.useWhen), entry.slug).toBe(false);
    purposes.add(guide.useWhen);
    expect(guide.related).not.toContain(entry.slug);
    expect(new Set(guide.related).size).toBe(guide.related.length);
    for (const slug of guide.related)
      expect(known.has(slug), `${entry.slug}: ${slug}`).toBe(true);
  }
});

it("keeps useful guidance in the Markdown reference without depending on a source payload", () => {
  const markdown = guideMarkdown(componentGuide("saas-audit-trail")).join("\n");
  expect(markdown).toContain("## When to use");
  expect(markdown).toContain("## When not to use");
  expect(markdown).toContain("selectMode");
  expect(markdown).not.toMatch(/export (function|default)|## JSON prompt/);
  expect(() => componentGuide("__proto__")).toThrow(
    "Missing public component guidance",
  );
});

it("does not introduce em dashes in the authored guidance", () => {
  expect(
    fs.readFileSync("content/components/guides.json", "utf8"),
  ).not.toContain("\u2014");
});
