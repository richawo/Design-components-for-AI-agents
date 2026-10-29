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
  const decode = packed.encoding === "gzip-base64" ? gunzipSync
    : packed.encoding === "brotli-base64" ? brotliDecompressSync : null;
  if (!decode) throw new Error("Unsupported content encoding");
  return JSON.parse(decode(Buffer.from(packed.data, "base64")).toString("utf8"));
}
