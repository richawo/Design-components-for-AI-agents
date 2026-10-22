import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { writePublicContentRuntime, assertSinglePublicContentCopy } from "../scripts/lib/public-content-runtime.mjs";
import { packContent, unpackContent } from "../scripts/lib/content-pack.mjs";
const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) fs.rmSync(dir, {recursive:true, force:true}); });
const fixture = () => { const dir=fs.mkdtempSync(path.join(os.tmpdir(), "dfa-public-pack-"));directories.push(dir);return dir; };
describe("shared public content package", () => {
  it("rejects missing or duplicated prepared payloads instead of accepting a size-only pass", () => {
    const packed={data:"sample-unique-public-data"};
    expect(assertSinglePublicContentCopy("const data='"+packed.data+"';",packed)).toBe(packed.data.length);
    expect(()=>assertSinglePublicContentCopy("no data",packed)).toThrow();
    expect(()=>assertSinglePublicContentCopy(packed.data+";"+packed.data,packed)).toThrow();
  });
  it("shares the exact complete payload between independent route consumers", () => {
    const root=fixture(),data={blog:{"guide.md":"# Hello\n"},localizedBlog:{ar:{"guide.md":"# مرحبا"}},docs:{"install.md":"# Install"}};
    const packed=packContent(data),dir=writePublicContentRuntime(root,packed);
    const a=createRequire(path.join(root,"route-a.cjs")),b=createRequire(path.join(root,"route-b.cjs"));
    expect(a("@design-yaps/public-content-runtime")).toBe(b("@design-yaps/public-content-runtime"));
    expect(unpackContent(a("@design-yaps/public-content-runtime"))).toEqual(data);
    const file=path.join(dir,"content-packed.json"),before=fs.statSync(file).mtimeMs;
    writePublicContentRuntime(root,packed);expect(fs.statSync(file).mtimeMs).toBe(before);
  });
  it("replaces a previous generated pack instead of keeping stale copy", () => {
    const root=fixture();writePublicContentRuntime(root,packContent({blog:{a:"old"}}));
    const dir=writePublicContentRuntime(root,packContent({blog:{a:"new"}}));
    expect(unpackContent(JSON.parse(fs.readFileSync(path.join(dir,"content-packed.json"),"utf8")))).toEqual({blog:{a:"new"}});
  });
});
