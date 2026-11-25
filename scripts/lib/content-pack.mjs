import { Buffer } from "node:buffer";
import { gzipSync, gunzipSync, brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";

export function packContent(content) {
  const bytes = Buffer.from(JSON.stringify(content));
  // Large multilingual bundles encode more compactly with Brotli.
  // Small component packs retain their established gzip format and build cost.
  return bytes.length >= 1024 * 1024
    ? { encoding: "brotli-base64", data: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 10 } }).toString("base64") }
    : { encoding: "gzip-base64", data: gzipSync(bytes, { level: 9 }).toString("base64") };
}

export function unpackContent(packed) {
  // Audit/build readers can still reconstruct the exact original bundle. The
  // request-time facade reads individual locale partitions instead.
  if (packed.encoding === "partitioned-public-v1" || packed.encoding === "partitioned-public-v2") {
    const core = unpackContent(packed.core);
    const readLocale = (entry) => entry.partitions
      ? Object.assign({}, ...entry.partitions.map((part) => unpackContent(part.packed)))
      : unpackContent(entry.packed);
    return Object.fromEntries(packed.fields.map((field) => [field,
      field === "blog" ? readLocale(packed.locales.en)
        : field === "localizedBlog" ? Object.fromEntries(Object.entries(packed.locales)
          .filter(([locale]) => locale !== "en").map(([locale, entry]) => [locale, readLocale(entry)]))
          : core[field],
    ]));
  }
  const decode = packed.encoding === "gzip-base64" ? gunzipSync
    : packed.encoding === "brotli-base64" ? brotliDecompressSync : null;
  if (!decode) throw new Error("Unsupported content encoding");
  return JSON.parse(decode(Buffer.from(packed.data, "base64")).toString("utf8"));
}
