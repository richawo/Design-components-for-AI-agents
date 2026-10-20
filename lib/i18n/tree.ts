import { Children, cloneElement, isValidElement, type ReactNode, type ReactElement } from "react";
import { LOCALES, localizePath } from "./routing";
import { translator, type Dictionary } from "./translate";
import { NoTranslation } from "./context";
import { createElement } from "react";

const TEXT_PROPS = new Set(["title", "alt", "placeholder", "aria-label", "aria-description", "aria-valuetext", "accessibilityLabel", "accessibilityHint"]);

/** Translate at the rendering boundary; state, callbacks, identifiers and source stay intact. */
export function treeLocalizer(locale: string, dictionary: Dictionary) {
  const t = translator(dictionary);
  const renderers = new WeakMap<Function, Function>();
  const schema = (value: unknown, field = ""): unknown => {
    if (typeof value === "string") {
      if (["name", "headline", "description", "text"].includes(field)) return t(value);
      if (["url", "item", "@id", "target"].includes(field) && value.startsWith("https://design.yaps.ai/")) return "https://design.yaps.ai" + localizePath(value.slice("https://design.yaps.ai".length), locale);
      if (field === "inLanguage") return LOCALES.find((item) => item.code === locale)?.htmlLang ?? locale;
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => schema(item, field));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, schema(child, key)]));
  };
  const localize = <T,>(node: T): T => {
    if (locale === "en") return node;
    if (typeof node === "string") return t(node) as T;
    if (Array.isArray(node)) return Children.map(node as ReactNode[], localize) as T;
    if (node && typeof node === "object" && "$$typeof" in node && node.$$typeof === Symbol.for("react.portal")) return { ...node, children: localize((node as unknown as { children: ReactNode }).children) };
    if (!isValidElement(node)) return node;
    const element = node as ReactElement<Record<string, unknown>>;
    if (element.type === NoTranslation || ["script", "style"].includes(element.type as string)) return node;
    if (["pre", "code", "kbd"].includes(element.type as string) || element.props.translate === "no") return createElement(NoTranslation, { children: node as ReactNode }) as T;
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(element.props)) {
      if ((key === "children" || key.startsWith("render")) && typeof value === "function") {
        let render = renderers.get(value);
        if (!render) { render = function(this: unknown, ...args: unknown[]) { return localize(value.apply(this, args)); }; renderers.set(value, render); }
        props[key] = render;
      }
      else if (key === "children" || ["fallback", "introduction", "cta", "emptyState"].includes(key)) props[key] = localize(value as ReactNode);
      else if (key === "href" && typeof value === "string") props[key] = localizePath(value, locale);
      else if (TEXT_PROPS.has(key) && typeof value === "string") props[key] = t(value);
      else if (key === "data" && value && typeof value === "object" && ("@context" in value || (Array.isArray(value) && value.some((item) => item && typeof item === "object" && "@context" in item)))) props[key] = schema(value);
      else if (key === "accessibilityValue" && value && typeof value === "object" && "text" in value && typeof value.text === "string") props[key] = { ...value, text: t(value.text) };
    }
    return cloneElement(element, props) as T;
  };
  return { localize, t, href: (path: string) => localizePath(path, locale), locale, dictionary };
}
