import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { parse } from "@babel/parser";
import { packContent, unpackContent } from "./content-pack.mjs";

// Read generated JSON data without evaluating the surrounding middleware code.
function literalData(node) {
  switch (node?.type) {
    case "ObjectExpression":
      return Object.fromEntries(node.properties.map(property => {
        if (property.type !== "ObjectProperty" || property.computed || property.method || property.shorthand) {
          throw new Error("Router manifest contains a non-data property");
        }
        const key = property.key.type === "Identifier" ? property.key.name
          : ["StringLiteral", "NumericLiteral"].includes(property.key.type) ? String(property.key.value) : null;
        if (key === null || key === "__proto__") throw new Error("Unsupported router manifest key");
        return [key, literalData(property.value)];
      }));
    case "ArrayExpression": return node.elements.map(literalData);
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral": return node.value;
    case "NullLiteral": return null;
    case "UnaryExpression":
      if (node.operator === "-" && node.argument.type === "NumericLiteral") return -node.argument.value;
      break;
  }
  throw new Error("Router manifest contains an unsupported expression");
}

/** Losslessly pack OpenNext's generated public routing data, preserving its lazy server boundary. */
export function packRouterManifest(source, expectedManifest, { minimumBytes = 128 * 1024 } = {}) {
  if (!Number.isSafeInteger(minimumBytes) || minimumBytes < 0) throw new Error("Invalid manifest packing threshold");
  if (source.includes("__dfa_route_manifest_")) throw new Error("Router manifest helper name collision");
  const ast = parse(source, { sourceType: "module" });
  const bindings = ast.program.body.flatMap(statement => {
    const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    return declaration?.type === "VariableDeclaration" ? declaration.declarations : [];
  }).filter(declaration => declaration.id.type === "Identifier" && declaration.id.name === "PrerenderManifest");
  if (bindings.length !== 1 || !bindings[0].init) throw new Error("OpenNext routing manifest declaration changed");
  const node = bindings[0].init;
  const manifest = literalData(node);
  if (!isDeepStrictEqual(manifest, expectedManifest)) throw new Error("Router manifest differs from the production build input");
  const json = JSON.stringify(manifest);
  const metadata = {
    manifestSha256: createHash("sha256").update(json).digest("hex"),
    manifestBytes: Buffer.byteLength(json),
    literalBytes: Buffer.byteLength(source.slice(node.start, node.end)),
    routes: Object.keys(manifest.routes ?? {}).length,
    beforeBytes: Buffer.byteLength(source),
  };
  if (metadata.manifestBytes < minimumBytes) return { ...metadata, code: source, packed: false, afterBytes: metadata.beforeBytes };
  const packed = packContent(manifest);
  if (!isDeepStrictEqual(unpackContent(packed), manifest) || JSON.stringify(unpackContent(packed)) !== json) {
    throw new Error("Packed router manifest did not preserve the complete original data and order");
  }
  const decoder = packed.encoding === "brotli-base64" ? "brotliDecompressSync" : "gunzipSync";
  const imports = `import { ${decoder} as __dfa_route_manifest_decode } from "node:zlib";\nimport { Buffer as __dfa_route_manifest_buffer } from "node:buffer";\n`;
  const expression = `JSON.parse(__dfa_route_manifest_decode(__dfa_route_manifest_buffer.from(${JSON.stringify(packed.data)}, "base64")).toString("utf8"))`;
  const code = imports + source.slice(0, node.start) + expression + source.slice(node.end);
  return { ...metadata, code, packed: true, encoding: packed.encoding, packedBytes: Buffer.byteLength(packed.data), afterBytes: Buffer.byteLength(code) };
}
