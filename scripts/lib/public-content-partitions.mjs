import { packContent, unpackContent } from "./content-pack.mjs";

// Keep the public corpus compressed in the shared server module. Expanding all
// thirty editions at module initialization exceeds the Worker's memory limit.
export function packPublicContent(content) {
  const { blog = {}, localizedBlog = {}, ...core } = content;
  return {
    encoding: "partitioned-public-v1",
    fields: Object.keys(content),
    core: packContent(core),
    locales: Object.fromEntries(Object.entries({ en: blog, ...localizedBlog }).map(([locale, files]) => [locale, {
      files: Object.keys(files), packed: packContent(files),
    }])),
  };
}

export function publicContentPayloads(packed) {
  return packed.encoding === "partitioned-public-v1"
    ? [packed.core, ...Object.values(packed.locales).map((entry) => entry.packed)]
    : [packed];
}

export function createPublicContent(packed) {
  if (packed.encoding !== "partitioned-public-v1") return unpackContent(packed);
  const core = unpackContent(packed.core);
  const recent = new Map();
  const readLocale = (locale) => {
    let files = recent.get(locale);
    if (!files) files = unpackContent(packed.locales[locale].packed);
    recent.delete(locale);
    recent.set(locale, files);
    // An article can need its selected edition and English source together.
    // Bound retention even when an MCP isolate serves many different locales.
    if (recent.size > 2) recent.delete(recent.keys().next().value);
    return files;
  };
  const localeFiles = Object.fromEntries(Object.entries(packed.locales).map(([locale, entry]) => {
    const names = new Set(entry.files);
    return [locale, new Proxy(Object.create(null), {
      ownKeys: () => entry.files,
      getOwnPropertyDescriptor: (_, name) => names.has(name) ? { enumerable: true, configurable: true } : undefined,
      get: (_, name) => names.has(name) ? readLocale(locale)[name] : undefined,
      has: (_, name) => names.has(name),
    })];
  }));
  return Object.fromEntries(packed.fields.map((field) => [field,
    field === "blog" ? localeFiles.en
      : field === "localizedBlog" ? Object.fromEntries(Object.entries(localeFiles).filter(([locale]) => locale !== "en"))
        : core[field],
  ]));
}
