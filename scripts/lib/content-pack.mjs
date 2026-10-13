import { Buffer } from "node:buffer";
import { gzipSync, gunzipSync } from "node:zlib";

export function packContent(content) {
  return { encoding: "gzip-base64", data: gzipSync(Buffer.from(JSON.stringify(content)), { level: 9 }).toString("base64") };
}

export function unpackContent(packed) {
  if (packed.encoding !== "gzip-base64") throw new Error("Unsupported content encoding");
  return JSON.parse(gunzipSync(Buffer.from(packed.data, "base64")).toString("utf8"));
}
