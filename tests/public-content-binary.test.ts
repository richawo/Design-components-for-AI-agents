import fs from "node:fs";
import { SourceMap } from "node:module";
import MagicString from "magic-string";
import { describe, expect, it } from "vitest";
import { prepareBinaryPublicContent, assertBinaryPublicContentCopy } from "../scripts/lib/public-content-binary.mjs";
import { packContent, unpackContent } from "../scripts/lib/content-pack.mjs";
import { createPublicContent, packPublicContent } from "../scripts/lib/public-content-partitions.mjs";

const fixture = () => ({ blog: { "a.md": "# Hello\n```js\nconst price = 25;\n```" }, localizedBlog: {
  ar: { "a.md": "# مرحبا" }, ja: { "a.md": "# 日本語" },
}, docs: { "install.md": "# Installation" }, config: { title: "Original" } });
const source = (packed: unknown) => `export default ${JSON.stringify(packed)};`;
function execute(output: ReturnType<typeof prepareBinaryPublicContent>, bufferClass: object = Buffer) {
  const code = output.code.split("\n").slice(2).join("\n").replace("export default ", "return ");
  const bytes = output.binary.buffer.slice(output.binary.byteOffset, output.binary.byteOffset + output.binary.byteLength);
  return new Function("__dfa_public_binary", "__dfa_public_buffer", code)(bytes, bufferClass);
}

describe("binary storage for the complete public pack", () => {
  it("restores the exact existing encoding and decoded contents without base64 module text", () => {
    const original = fixture(), packed = packPublicContent(original);
    const out = prepareBinaryPublicContent(source(packed), packed), restored = execute(out);
    expect(JSON.stringify(restored)).toBe(JSON.stringify(packed));
    expect(unpackContent(restored)).toEqual(original);
    expect(JSON.stringify(createPublicContent(restored))).toBe(JSON.stringify(original));
    expect(out.binaryBytes).toBeLessThan(out.encodedBytesBefore);
    expect(assertBinaryPublicContentCopy(out.code, out.binary, packed).binarySha256).toBe(out.binarySha256);
  });

  it("materializes only the requested payload and preserves two-partition eviction", () => {
    const packed = packPublicContent(fixture()), out = prepareBinaryPublicContent(source(packed), packed);
    let conversions = 0;
    const restored = execute(out, { from: (bytes: ArrayBuffer, offset: number, length: number) => { conversions++; return Buffer.from(bytes, offset, length); } });
    const data = createPublicContent(restored) as ReturnType<typeof fixture>;
    expect(conversions).toBe(1); // Public metadata only.
    expect(Object.keys(data.blog)).toEqual(["a.md"]);
    expect(Object.keys(data.localizedBlog)).toEqual(["ar", "ja"]);
    expect(Object.keys(data.localizedBlog.ar)).toEqual(["a.md"]);
    expect(conversions).toBe(1);
    expect(data.blog["a.md"]).toContain("const price = 25;");
    expect(data.localizedBlog.ar["a.md"]).toBe("# مرحبا");
    expect(conversions).toBe(3);
    expect(data.blog["a.md"]).toContain("# Hello");
    expect(conversions).toBe(3);
    expect(data.localizedBlog.ja["a.md"]).toBe("# 日本語");
    expect(conversions).toBe(4);
    expect(data.localizedBlog.ar["a.md"]).toBe("# مرحبا");
    expect(conversions).toBe(5);
    expect(data.blog["a.md"]).toContain("# Hello");
    expect(conversions).toBe(6);
  });

  it("retains legacy payloads and identical payload multiplicity with one binary copy", () => {
    const legacy = packContent(fixture());
    expect(unpackContent(execute(prepareBinaryPublicContent(source(legacy), legacy)))).toEqual(fixture());
    const packed = packPublicContent({ blog: { a: "same" }, localizedBlog: { ar: { a: "same" } } });
    const out = prepareBinaryPublicContent(source(packed), packed);
    expect(out.payloads.some((p) => p.copies === 2)).toBe(true);
    expect(JSON.stringify(execute(out))).toBe(JSON.stringify(packed));
  });

  it("rejects missing, duplicated, opaque or changed declarations instead of accepting smaller output", () => {
    const packed = packContent(fixture());
    expect(() => prepareBinaryPublicContent("export default {};", packed)).toThrow();
    expect(() => prepareBinaryPublicContent(source(packed) + source(packed), packed)).toThrow();
    expect(() => prepareBinaryPublicContent(`export default ${JSON.stringify(JSON.stringify(packed))};`, packed)).toThrow();
    expect(() => prepareBinaryPublicContent(source({ ...packed, encoding: "unknown" }), packed)).toThrow();
    expect(() => prepareBinaryPublicContent(source({ ...packed, extra: true }), packed)).toThrow();
    const out = prepareBinaryPublicContent(source(packed), packed);
    expect(() => prepareBinaryPublicContent(out.code, packed)).toThrow();
  });

  it("rejects corruption, truncation, duplicate imports and altered payload references", () => {
    const packed = packPublicContent(fixture()), out = prepareBinaryPublicContent(source(packed), packed);
    const changed = Buffer.from(out.binary); changed[0] ^= 1;
    expect(() => assertBinaryPublicContentCopy(out.code, changed, packed)).toThrow();
    expect(() => assertBinaryPublicContentCopy(out.code, out.binary.subarray(1), packed)).toThrow();
    expect(() => assertBinaryPublicContentCopy(out.code + out.code, out.binary, packed)).toThrow();
    expect(() => assertBinaryPublicContentCopy(out.code.replace("get data()", "get absent()"), out.binary, packed)).toThrow();
  });

  it("remaps untouched code after the shortened payload to its original source location", () => {
    const packed = packPublicContent(fixture());
    const before = `const payload=${JSON.stringify(packed)};\nexport const sentinel=42;`;
    const inputMap = JSON.parse(new MagicString(before).generateMap({ source: "original.mjs", includeContent: true, hires: "boundary" }).toString());
    const out = prepareBinaryPublicContent(before, packed, { sourceMap: inputMap });
    const position = out.code.indexOf("sentinel"), lines = out.code.slice(0, position).split("\n");
    const entry = new SourceMap(out.map as ConstructorParameters<typeof SourceMap>[0]).findEntry(lines.length - 1, lines.at(-1)!.length);
    expect(entry).toMatchObject({ originalSource: expect.stringContaining("original.mjs"), originalLine: 1, originalColumn: 13 });
  });

  it("round-trips every byte of the current complete multilingual corpus", () => {
    const packed = JSON.parse(fs.readFileSync(new URL("../registry/__generated__/content-packed.json", import.meta.url), "utf8"));
    const original = JSON.parse(fs.readFileSync(new URL("../registry/__generated__/content.json", import.meta.url), "utf8"));
    const out = prepareBinaryPublicContent(source(packed), packed);
    expect(JSON.stringify(unpackContent(execute(out)))).toBe(JSON.stringify(original));
    expect(JSON.stringify(createPublicContent(execute(out)))).toBe(JSON.stringify(original));
    expect(out.binaryBytes).toBeLessThan(out.encodedBytesBefore * 0.76);
  });
});
