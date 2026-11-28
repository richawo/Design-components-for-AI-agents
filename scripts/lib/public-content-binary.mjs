import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { parse } from "@babel/parser";
import MagicString from "magic-string";
import remapping from "@jridgewell/remapping";
import { publicContentPayloads } from "./public-content-partitions.mjs";
import { assertSinglePublicContentCopy } from "./public-content-runtime.mjs";

export const PUBLIC_CONTENT_BINARY = "public-content-payloads.bin";
const binaryName = "__dfa_public_binary", bufferName = "__dfa_public_buffer";
const imports = `import ${binaryName} from "./${PUBLIC_CONTENT_BINARY}";\nimport { Buffer as ${bufferName} } from "node:buffer";\n`;
const getter = ({ offset, bytes }) => `get data(){return ${bufferName}.from(${binaryName},${offset},${bytes}).toString("base64");}`;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

function binaryLayout(packed) {
  const payloads = new Map();
  let offset = 0;
  for (const payload of publicContentPayloads(packed)) {
    if (!["gzip-base64", "brotli-base64"].includes(payload.encoding) || typeof payload.data !== "string") throw new Error("Unsupported public payload");
    const bytes = Buffer.from(payload.data, "base64");
    if (!bytes.length || bytes.toString("base64") !== payload.data) throw new Error("Invalid canonical public payload");
    const previous = payloads.get(payload.data);
    if (previous) {
      if (previous.encoding !== payload.encoding) throw new Error("Conflicting public payload encoding");
      previous.copies++;
    } else {
      payloads.set(payload.data, { offset, bytes: bytes.length, encoding: payload.encoding, copies: 1, sha256: sha(bytes), value: bytes });
      offset += bytes.length;
    }
  }
  return { payloads, binary: Buffer.concat([...payloads.values()].map((p) => p.value)) };
}

/** Change storage only: preserve the existing decoder contract and selected-partition LRU. */
export function prepareBinaryPublicContent(source, packed, { sourceMap, file = "lazy-server.mjs" } = {}) {
  if (source.includes(binaryName) || source.includes(bufferName)) throw new Error("Public binary helper name collision");
  assertSinglePublicContentCopy(source, packed);
  const { payloads, binary } = binaryLayout(packed), replacements = [], counts = new Map();
  const ast = parse(source, { sourceType: "module", attachComment: false });
  const pending = [ast];
  while (pending.length) {
    const node = pending.pop();
    if (node.type === "ObjectExpression") {
      const key = (p) => p.type === "ObjectProperty" && !p.computed && !p.shorthand
        ? (p.key.type === "Identifier" ? p.key.name : p.key.type === "StringLiteral" ? p.key.value : null) : null;
      const data = node.properties.find((p) => key(p) === "data");
      if (data?.value.type === "StringLiteral" && payloads.has(data.value.value)) {
        const payload = payloads.get(data.value.value), encoding = node.properties.find((p) => key(p) === "encoding");
        if (node.properties.length !== 2 || encoding?.value.type !== "StringLiteral" || encoding.value.value !== payload.encoding) throw new Error("Prepared public payload declaration changed");
        replacements.push({ start: data.start, end: data.end, payload });
        counts.set(data.value.value, (counts.get(data.value.value) ?? 0) + 1);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === "string") pending.push(child);
      } else if (value && typeof value.type === "string") pending.push(value);
    }
  }
  for (const [data, payload] of payloads) if (counts.get(data) !== payload.copies) throw new Error("Public payload must be an intact data declaration");
  const edited = new MagicString(source);
  for (const { start, end, payload } of replacements) edited.overwrite(start, end, getter(payload));
  edited.prepend(imports);
  const code = edited.toString();
  const map = sourceMap ? remapping([
    JSON.parse(edited.generateMap({ file, source: file, includeContent: false, hires: "boundary" }).toString()), sourceMap,
  ], () => null) : null;
  const verification = assertBinaryPublicContentCopy(code, binary, packed);
  return { code, binary, map, ...verification, encodedBytesBefore: [...payloads].reduce((n, [data, p]) => n + data.length * p.copies, 0) };
}

/** Fail closed for omitted, changed, duplicated or unreferenced public bytes after Wrangler. */
export function assertBinaryPublicContentCopy(source, actualBinary, packed) {
  const { payloads, binary } = binaryLayout(packed);
  if (!Buffer.from(actualBinary).equals(binary)) throw new Error("Prepared public binary differs from the complete source pack");
  if (source.split(imports).length !== 2) throw new Error("Prepared server lost its single public binary import");
  for (const [data, payload] of payloads) {
    if (source.includes(data) || source.split(getter(payload)).length - 1 !== payload.copies) throw new Error("Prepared server must reference each complete public payload exactly once");
  }
  return { binaryBytes: binary.length, binarySha256: sha(binary), payloads: [...payloads.values()].map(({ value, ...entry }) => entry) };
}
