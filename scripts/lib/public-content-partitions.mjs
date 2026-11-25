import { packContent, unpackContent } from "./content-pack.mjs";
import { Buffer } from "node:buffer";

const MAX_PARTITION_BYTES = 2 * 1024 * 1024;

function partitionFiles(files) {
  const entries = Object.entries(files);
  const sizes = entries.map(([name, value]) => Buffer.byteLength(JSON.stringify({ [name]: value })) - 2);
  const split = (start, end) => {
    const bytes = 2 + sizes.slice(start, end).reduce((sum, size) => sum + size, 0) + Math.max(0, end - start - 1);
    if (bytes < MAX_PARTITION_BYTES) {
      const part = Object.fromEntries(entries.slice(start, end));
      return [{ files: Object.keys(part), packed: packContent(part) }];
    }
    if (end - start === 1) throw new Error(`Public article exceeds the 2 MiB partition limit: ${entries[start][0]}`);
    let middle = start + 1, left = sizes[start];
    while (middle < end - 1 && left < bytes / 2) left += sizes[middle++] + 1;
    return [...split(start, middle), ...split(middle, end)];
  };
  return split(0, entries.length);
}

// Keep the public corpus compressed in the shared server module. Expanding all
// thirty editions at module initialization exceeds the Worker's memory limit.
export function packPublicContent(content) {
  const { blog = {}, localizedBlog = {}, ...core } = content;
  return {
    encoding: "partitioned-public-v2",
    fields: Object.keys(content),
    core: packContent(core),
    locales: Object.fromEntries(Object.entries({ en: blog, ...localizedBlog }).map(([locale, files]) => [locale, {
      files: Object.keys(files), partitions: partitionFiles(files),
    }])),
  };
}

export function publicContentPayloads(packed) {
  return packed.encoding === "partitioned-public-v1" || packed.encoding === "partitioned-public-v2"
    ? [packed.core, ...Object.values(packed.locales).flatMap((entry) => entry.partitions ? entry.partitions.map((part) => part.packed) : [entry.packed])]
    : [packed];
}

export function createPublicContent(packed) {
  if (packed.encoding !== "partitioned-public-v1" && packed.encoding !== "partitioned-public-v2") return unpackContent(packed);
  const core = unpackContent(packed.core);
  const recent = new Map();
  const readPartition = (partition) => {
    let files = recent.get(partition);
    if (!files) files = unpackContent(partition.packed);
    recent.delete(partition);
    recent.set(partition, files);
    // An article can need its selected edition and English source together.
    // Bound retention to two sub-2 MiB partitions, including within one locale.
    if (recent.size > 2) recent.delete(recent.keys().next().value);
    return files;
  };
  const localeFiles = Object.fromEntries(Object.entries(packed.locales).map(([locale, entry]) => {
    const names = new Set(entry.files);
    const partitions = new Map((entry.partitions ?? [entry]).flatMap((part) => part.files.map((name) => [name, part])));
    return [locale, new Proxy(Object.create(null), {
      ownKeys: () => entry.files,
      getOwnPropertyDescriptor: (_, name) => names.has(name) ? { enumerable: true, configurable: true } : undefined,
      get: (_, name) => names.has(name) ? readPartition(partitions.get(name))[name] : undefined,
      has: (_, name) => names.has(name),
    })];
  }));
  return Object.fromEntries(packed.fields.map((field) => [field,
    field === "blog" ? localeFiles.en
      : field === "localizedBlog" ? Object.fromEntries(Object.entries(localeFiles).filter(([locale]) => locale !== "en"))
        : core[field],
  ]));
}
