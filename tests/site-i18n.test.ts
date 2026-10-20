import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createPortal } from "react-dom";
import { createRequire } from "node:module";
import { parse } from "@babel/parser";
import { localizePath, preferredLocale, unlocalizePath } from "@/lib/i18n/routing";
import { treeLocalizer } from "@/lib/i18n/tree";
import { translator, translateDisplay } from "@/lib/i18n/translate";
import { getDoc } from "@/lib/content";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { GET as claim } from "@/app/api/license/claim/route";
import { previewControls, previewFormatLocale } from "@/lib/i18n/preview";
import { defaultValues, diffValues } from "@/lib/demo/protocol";
import type { ComponentControl } from "@/lib/registry-types";
import { SiteI18n, useSiteI18n } from "@/components/site/site-i18n";

describe("whole-site language editions", () => {
  it("keeps the current page, filters and anchor when switching editions", () => {
    expect(localizePath("/fr/components?category=charts&tier=free#preview", "de")).toBe("/de/components?category=charts&tier=free#preview");
    expect(localizePath("/?q=charts#main", "ar")).toBe("/ar?q=charts#main");
    expect(unlocalizePath("/zh-hans/docs/agents")).toBe("/docs/agents");
    expect(localizePath("/en/pricing", "fr")).toBe("/fr/pricing");
    expect(localizePath("/fr/preview/chart-portfolio", "en")).toBe("/preview/chart-portfolio");
  });
  it("preserves machine endpoints, install commands, external links and assets", () => {
    for (const path of ["/api/account", "/r/chart-portfolio.json", "/_next/static/a.js", "/previews/chart.webp", "/mcp", "/llms.txt", "https://github.com/richawo", "//example.com/file"]) expect(localizePath(path, "fr")).toBe(path);
  });
  it("preserves a validated language preference on billing returns without caching it", async () => {
    expect(preferredLocale("theme=dark; design-locale=fr")).toBe("fr");
    expect(preferredLocale("design-locale=https://example.com")).toBe("en");
    const request = new NextRequest("https://design.yaps.ai/account?welcome=1", { headers: { Cookie: "design-locale=fr" } });
    const response = proxy(request);
    expect(response.headers.get("location")).toBe("https://design.yaps.ai/fr/account?welcome=1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    const cancelled = proxy(new NextRequest("https://design.yaps.ai/pricing?cancelled=1", { headers: { Cookie: "design-locale=de" } }));
    expect(cancelled.headers.get("location")).toBe("https://design.yaps.ai/de/pricing?cancelled=1");
    const claimed = await claim(new Request("https://design.yaps.ai/api/license/claim", { headers: { Cookie: "design-locale=fr" } }));
    expect(claimed.headers.get("location")).toBe("https://design.yaps.ai/fr/pricing");
    expect(claimed.headers.get("cache-control")).toBe("private, no-store");
  });
  it("preserves documentation anchors across languages while translating their labels", async () => {
    const [english, french] = await Promise.all([getDoc("principles"), getDoc("principles", "fr")]);
    expect(french!.headings.map((heading) => heading.id)).toEqual(english!.headings.map((heading) => heading.id));
    expect(french!.headings[0].text).not.toBe(english!.headings[0].text);
    const installation = await getDoc("installation", "fr");
    expect(installation!.html).toContain('href="/fr/account"');
    expect(installation!.markdown).toContain('href="/fr/account"');
  });
  it("keeps locale controls usable when the site language changes their initial selection", () => {
    const original: ComponentControl[] = [{ prop: "locale", label: "Language", kind: "select", default: "en-US", options: ["en-US", "fr-FR"] }];
    const french = previewControls(original, "fr");
    expect(defaultValues(french).locale).toBe("fr-FR");
    expect(previewFormatLocale(original, "fr")).toBe("fr-FR");
    expect(diffValues(french, { locale: "en-US" })).toEqual({ locale: "en-US" });
    expect(original[0].default).toBe("en-US");
    expect(previewFormatLocale(original, "ar")).toBe("en-US");
  });
  it("translates rendered copy and accessible names while preserving values and code", () => {
    const { localize } = treeLocalizer("fr", { "Free": "Gratuit", "Search components": "Rechercher des composants", "Copy": "Copier" });
    const markup = renderToStaticMarkup(localize(createElement("section", {},
      createElement("h2", {}, "Free"),
      createElement("input", { value: "Free", readOnly: true, placeholder: "Search components", "aria-label": "Search components" }),
      createElement("a", { href: "/components?tier=free" }, "Free"),
      createElement("code", {}, "Free"),
      createElement("span", { translate: "no" }, "Free"),
      createElement("button", { "aria-label": "Copy" }, "Copy"),
    )));
    expect(markup).toContain("<h2>Gratuit</h2>");
    expect(markup).toContain('value="Free"');
    expect(markup).toContain('aria-label="Rechercher des composants"');
    expect(markup).toContain('href="/fr/components?tier=free"');
    expect(markup).toContain("<code>Free</code>");
    expect(markup).toContain('<span translate="no">Free</span>');
  });
  it("supports dynamic sentences without translating prop contracts or corrupting prices", () => {
    const t = translator({ "Explore {{0}}": "Découvrir {{0}}", "Portfolio Chart": "Graphique de portefeuille", "{{0}} components": "{{0}} composants" });
    expect(t("Explore Portfolio Chart")).toBe("Découvrir Graphique de portefeuille");
    expect(t("359 components")).toBe("359 composants");
    expect(t("className")).toBe("className");
    expect(t("constructor")).toBe("constructor");
    expect(t("__proto__")).toBe("__proto__");
  });
  it("retains domain data and callback identity while translating only the rendered result", () => {
    const { localize } = treeLocalizer("fr", { "Free": "Gratuit" });
    const items = [{ id: "free", name: "Free", title: "Free" }];
    const change = () => {};
    const Component = (_props: { items: typeof items; data: typeof items; onChange: typeof change }) => null;
    const result = localize(createElement(Component, { items, data: items, onChange: change }));
    expect(result.props.items).toBe(items);
    expect(result.props.data).toBe(items);
    expect(result.props.onChange).toBe(change);
  });
  it("preserves code tokens across nested component boundaries", () => {
    function Token() { return useSiteI18n().localize(createElement("span", {}, "name")); }
    function Page() { return useSiteI18n().localize(createElement("section", {}, createElement("pre", {}, createElement(Token)), createElement("button", {}, "Name"))); }
    const markup = renderToStaticMarkup(createElement(SiteI18n, { locale: "fr", dictionary: { Name: "Nom" }, children: createElement(Page) }));
    expect(markup).toContain("<pre><span>name</span></pre>");
    expect(markup).toContain("<button>Nom</button>");
  });
  it("translates modal portals without changing their destination", () => {
    const container = { nodeType: 1 } as HTMLElement;
    const portal = createPortal(createElement("button", {}, "Close"), container);
    const { localize } = treeLocalizer("fr", { Close: "Fermer" });
    const result = localize(portal);
    expect((result as unknown as { containerInfo: HTMLElement }).containerInfo).toBe(container);
    expect(renderToStaticMarkup(result.children)).toBe("<button>Fermer</button>");
  });
  it("keeps render callbacks stable while translating their output", () => {
    const { localize } = treeLocalizer("fr", { Close: "Fermer" });
    const renderItem = () => createElement("span", {}, "Close");
    const Component = (_props: { renderItem: typeof renderItem }) => null;
    const first = localize(createElement(Component, { renderItem }));
    const next = localize(createElement(Component, { renderItem }));
    expect(first.props.renderItem).toBe(next.props.renderItem);
    expect(renderToStaticMarkup(first.props.renderItem())).toBe("<span>Fermer</span>");
  });
  it("instruments both block and arrow previews without changing the published source", () => {
    const { transform } = createRequire(import.meta.url)("../scripts/lib/localize-jsx.cjs");
    const source = '"use client"; import { useReducedMotion } from "motion/react"; export const Demo = () => (<div>Hello</div>); export function Panel() { const reduce = useReducedMotion(); const click = () => "Ready"; return <button onClick={click}>Ready</button>; }';
    const result = transform(source);
    expect(() => parse(result, { sourceType: "module", plugins: ["typescript", "jsx"] })).not.toThrow();
    expect(result.match(/= __useSiteI18n\(\)/g)).toHaveLength(2);
    expect(result).toContain('const click = () => "Ready"');
    expect(result).toContain('from "@/lib/use-reduced-motion"');
    expect(source).not.toContain("useSiteI18n");
  });
  it("also translates anonymous defaults and memo/forwardRef component bodies", () => {
    const { transform } = createRequire(import.meta.url)("../scripts/lib/localize-jsx.cjs");
    const source = 'const Panel = memo(() => <div>Ready</div>); const Button = forwardRef((props, ref) => <button ref={ref}>Save</button>); export default () => <Panel />;';
    const result = transform(source);
    expect(() => parse(result, { sourceType: "module", plugins: ["typescript", "jsx"] })).not.toThrow();
    expect(result.match(/= __useSiteI18n\(\)/g)).toHaveLength(3);
  });
  it("translates glyph-based display copy before splitting, keeping line breaks and domain data", () => {
    const t = translator({ "Build": "Créer", "Together": "Ensemble" });
    expect(translateDisplay("Build\nTogether", t)).toBe("Créer\nEnsemble");
    const records = [{ id: "build", title: "Build" }];
    expect(translateDisplay(records, t)).toBe(records);
    const { transform } = createRequire(import.meta.url)("../scripts/lib/localize-jsx.cjs");
    const source = 'export function TextDecode({ text = "Build", onDone }: Props) { return <span onClick={onDone}>{Array.from(text).map(char => <i>{char}</i>)}</span>; }';
    const result = transform(source, "/registry/free/text-decode/text-decode.tsx");
    expect(() => parse(result, { sourceType: "module", plugins: ["typescript", "jsx"] })).not.toThrow();
    expect(result).toContain('text: __i18nInput_text = "Build"');
    expect(result).toContain('__displayCopy(__i18nInput_text, __t)');
    expect(result).toContain('onClick={onDone}');
  });
  it("translates streamed display text before tokenizing without changing the input record", () => {
    const { transform } = createRequire(import.meta.url)("../scripts/lib/localize-jsx.cjs");
    const source = 'function AnswerView({ answer, onSelect }) { const words = useMemo(() => answer.map(p => p.text.split(" ")), [answer]); return <button onClick={() => onSelect(answer)}>{words.flat()}</button>; }';
    const result = transform(source, "/registry/pro/diagram-rag-pipeline/diagram-rag-pipeline.tsx");
    expect(() => parse(result, { sourceType: "module", plugins: ["typescript", "jsx"] })).not.toThrow();
    expect(result).toContain('__displayCopy(p.text, __t).split(" ")');
    expect(result).toContain('[answer, __t]');
    expect(result).toContain('onSelect(answer)');
    const hook = transform('function useScriptedSearch() { const ask = useCallback(search => streamPrefixes(search.answer, 2), []); return { ask }; }', "/registry/pro/ai-search-answer/ai-search-answer.tsx");
    expect(() => parse(hook, { sourceType: "module", plugins: ["typescript", "jsx"] })).not.toThrow();
    expect(hook).toContain('__displayCopy(search.answer, __t)');
    expect(hook).toContain('[__t]');
  });
});
