import { beforeEach, describe, expect, it, vi } from "vitest";
import matter from "gray-matter";
import { marked } from "marked";
import { decodeEntities } from "@/scripts/lib/translation-tokens.mjs";

const metadataKey = "Persist { ticketId, priority, assigneeId }. If rejected, show the failure and restore the previous route or inbox unless a newer host routing state takes precedence.";
const supportFrench = "Enregistrer { ticketId, priority, assigneeId }. En cas de rejet, rétablir la route précédente ou la boîte de réception, sauf si un état plus récent prévaut.";
const otherFrench = "Autre traduction propre à ce composant.";
const blockFrench = "Traduction propre au bloc.";
const decisionKey = 'Records { decision: "approve" | "reject" } and shows a failure.';
const decisionFrench = 'Enregistre { decision: "approve" | "reject" } et affiche une erreur.';

vi.mock("@/lib/registry", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/registry")>();
  return {
    ...original,
    readSource: vi.fn(original.readSource),
    getComponent(slug: string) {
      const entry = original.getComponent(slug);
      if (!entry || !["saas-support-triage", "chart-portfolio", "block-saas-landing"].includes(slug)) return entry;
      return {
        ...entry,
        props: [
          { name: "onTriage", type: "(update: SupportTriageUpdate) => void | Promise<void>", description: metadataKey },
          { name: "onDecision", type: '"approve" | "reject"', default: '"approve" | "reject"', description: decisionKey },
        ],
      };
    },
  };
});

vi.mock("@/lib/i18n/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/i18n/server")>();
  return {
    ...original,
    siteDictionary: vi.fn(async () => ({ [metadataKey]: "Valeur générale périmée." })),
    entryCopy: vi.fn(async (locale: string, slug: string) => {
      if (slug === "saas-support-triage") return { [metadataKey]: locale === "fr" ? supportFrench : `translated-${locale}`, [decisionKey]: decisionFrench };
      if (locale !== "fr") return {};
      if (slug === "chart-portfolio") return { [metadataKey]: otherFrench };
      if (slug === "block-saas-landing") return { [metadataKey]: blockFrench };
      return {};
    }),
  };
});

import { GET as componentMarkdown } from "@/app/md/components/[slug]/route";
import { GET as blockMarkdown } from "@/app/md/blocks/[slug]/route";
import { GET as localizedMarkdown } from "@/app/md/localized/[locale]/[...path]/route";
import { GET as siteMarkdown } from "@/app/md/page/[...path]/route";
import { allPosts } from "@/lib/content";
import { LOCALES } from "@/lib/blog/locales.mjs";
import { entryCopy } from "@/lib/i18n/server";
import { handleMessage } from "@/lib/mcp";
import { markdownForPage } from "@/lib/page-markdown";
import { readSource } from "@/lib/registry";

const anon = { license: { ok: false as const, reason: "missing" as const } };
const request = () => new Request("https://design.yaps.ai/");
const local = (path: string[]) => localizedMarkdown(request(), { params: Promise.resolve({ locale: "fr", path }) });
const call = async (path: string) => {
  const response = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_page", arguments: { path } } }, anon) as {
    result: { content: { text: string }[]; isError?: boolean };
  };
  return response.result;
};

describe("MCP and localized Markdown page parity", () => {
  beforeEach(() => {
    vi.mocked(entryCopy).mockClear();
    vi.mocked(readSource).mockClear();
  });

  it("uses only the requested entry's overlay for changed component metadata", async () => {
    const support = await local(["components", "saas-support-triage"]);
    const text = await support.text();
    expect(support.status).toBe(200);
    expect(text).toContain(supportFrench);
    expect(text).not.toContain(metadataKey);
    expect(text).not.toContain("Valeur générale périmée.");
    expect(matter(text).data.canonical).toBe("https://design.yaps.ai/fr/components/saas-support-triage");
    expect(entryCopy).toHaveBeenCalledTimes(1);
    expect(entryCopy).toHaveBeenCalledWith("fr", "saas-support-triage");

    vi.mocked(entryCopy).mockClear();
    const other = await local(["components", "chart-portfolio"]);
    const otherText = await other.text();
    expect(otherText).toContain(otherFrench);
    expect(otherText).not.toContain(supportFrench);
    expect(entryCopy).toHaveBeenCalledTimes(1);
    expect(entryCopy).toHaveBeenCalledWith("fr", "chart-portfolio");

    vi.mocked(entryCopy).mockClear();
    const block = await local(["blocks", "block-saas-landing"]);
    expect(await block.text()).toContain(blockFrench);
    expect(entryCopy).toHaveBeenCalledTimes(1);
    expect(entryCopy).toHaveBeenCalledWith("fr", "block-saas-landing");
  });

  it("loads the selected entry overlay in every additional locale", async () => {
    for (const locale of LOCALES.filter((item) => item.code !== "en")) {
      const response = await localizedMarkdown(request(), { params: Promise.resolve({ locale: locale.code, path: ["components", "saas-support-triage"] }) });
      expect(response.status, locale.code).toBe(200);
      const text = await response.text();
      expect(text, locale.code).toContain(locale.code === "fr" ? supportFrench : `translated-${locale.code}`);
      expect(text, locale.code).not.toContain(metadataKey);
    }
    expect(entryCopy).toHaveBeenCalledTimes(29);
  });

  it("preserves a union type and translated description as separate Markdown table cells through MCP", async () => {
    const response = await local(["components", "saas-support-triage"]);
    const markdown = await response.text();
    const tables = marked.lexer(matter(markdown).content).filter((token) => token.type === "table");
    const row = tables.flatMap((table) => table.rows).find((cells) => cells[0].text.includes("onTriage"));
    expect(row).toHaveLength(4);
    expect(row![1].text).toContain("void | Promise&lt;void&gt;");
    expect(row![3].text).toBe(supportFrench);
    expect((await call("fr/components/saas-support-triage")).content[0].text).toBe(markdown);
  });

  it("preserves pipes in type, default and description cells in English and French", async () => {
    const english = await componentMarkdown(request(), { params: Promise.resolve({ slug: "saas-support-triage" }) });
    const french = await local(["components", "saas-support-triage"]);
    for (const [path, response, expectedDescription] of [
      ["components/saas-support-triage", english, decisionKey],
      ["fr/components/saas-support-triage", french, decisionFrench],
    ] as const) {
      const markdown = await response.text();
      const tables = marked.lexer(matter(markdown).content).filter((token) => token.type === "table");
      const row = tables.flatMap((table) => table.rows).find((cells) => cells[0].text.includes("onDecision"));
      expect(row, path).toHaveLength(4);
      expect(decodeEntities(row![1].text), path).toContain('"approve" | "reject"');
      expect(decodeEntities(row![2].text), path).toContain('"approve" | "reject"');
      expect(decodeEntities(row![3].text), path).toBe(expectedDescription);
      expect((await call(path)).content[0].text).toBe(markdown);
    }
  });

  it("returns the exact English and localized documentation Markdown from get_page", async () => {
    const english = await siteMarkdown(request(), { params: Promise.resolve({ path: ["docs", "license"] }) });
    const french = await local(["docs", "license"]);
    const englishPage = await call("docs/license");
    const frenchPage = await call("fr/docs/license");
    expect(englishPage.isError).not.toBe(true);
    expect(frenchPage.isError).not.toBe(true);
    expect(englishPage.content[0].text).toBe(await english.text());
    expect(frenchPage.content[0].text).toBe(await french.text());
    expect(matter(frenchPage.content[0].text).data.canonical).toBe("https://design.yaps.ai/fr/docs/license");
    expect(entryCopy).not.toHaveBeenCalled();
  });

  it("returns the exact component and block Markdown while keeping Pro source private", async () => {
    const cases = [
      { path: "components/saas-support-triage", site: () => componentMarkdown(request(), { params: Promise.resolve({ slug: "saas-support-triage" }) }) },
      { path: "fr/components/saas-support-triage", site: () => local(["components", "saas-support-triage"]) },
      { path: "blocks/block-saas-landing", site: () => blockMarkdown(request(), { params: Promise.resolve({ slug: "block-saas-landing" }) }) },
      { path: "fr/blocks/block-saas-landing", site: () => local(["blocks", "block-saas-landing"]) },
    ];
    for (const item of cases) {
      const site = await item.site();
      expect(site.status, item.path).toBe(200);
      const actual = await call(item.path);
      expect(actual.isError, item.path).not.toBe(true);
      expect(actual.content[0].text, item.path).toBe(await site.text());
      expect(actual.content[0].text, item.path).not.toContain("## Source (");
      expect(actual.content[0].text, item.path).not.toContain("## JSON prompt");
    }
    expect(readSource).not.toHaveBeenCalled();
    const free = await call("components/chart-portfolio");
    expect(free.isError).not.toBe(true);
    expect(free.content[0].text).toContain("## Source (");
    expect(readSource).toHaveBeenCalledWith("chart-portfolio");
    const canonicalBlock = await call("blocks/block-saas-landing");
    const legacyBlock = await call("components/block-saas-landing");
    expect(legacyBlock.content[0].text).toBe(canonicalBlock.content[0].text);
    expect(matter(legacyBlock.content[0].text).data.canonical).toBe("https://design.yaps.ai/blocks/block-saas-landing");
    const canonicalFrenchBlock = await call("fr/blocks/block-saas-landing");
    const legacyFrenchBlock = await call("fr/components/block-saas-landing");
    expect(legacyFrenchBlock.content[0].text).toBe(canonicalFrenchBlock.content[0].text);
    expect(matter(legacyFrenchBlock.content[0].text).data.canonical).toBe("https://design.yaps.ai/fr/blocks/block-saas-landing");
    expect((await call("blocks/chart-portfolio")).isError).toBe(true);
    expect((await call("fr/blocks/chart-portfolio")).isError).toBe(true);
    expect((await call("fr/components/missing-component")).isError).toBe(true);
  });

  it("rejects unsupported locales and paths without fetching arbitrary URLs", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    try {
      for (const path of ["https://example.invalid/private", "//example.invalid/private", "zz/docs/license", "fr/../../private", "fr/components/../../private"]) {
        expect((await call(path)).isError, path).toBe(true);
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it("preserves localized blog get_page behavior", async () => {
    const post = allPosts("fr")[0];
    expect(post).toBeDefined();
    const path = `fr/blog/${post.slug}`;
    const result = await call(path);
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toBe(await markdownForPage(path));
    expect(result.content[0].text).toContain(`canonical: https://design.yaps.ai/${path}`);
  });
});
