import {describe,expect,it} from "vitest";
import {createHash} from "node:crypto";
import {packCachedContent} from "../scripts/lib/content-pack-cache.mjs";
import {packContent,unpackContent} from "../scripts/lib/content-pack.mjs";

const sha=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const content={en:"Preserve <strong>this source</strong>.",ar:"دليل التصميم",code:'const price = "£20";'};
describe("verified build content reuse",()=>{
  it("reuses exact encoded bytes only for matching inputs and encoder",()=>{
    const first=packCachedContent(content,{codecIdentity:"encoder-a"});
    expect(first.reused).toBe(false);expect(unpackContent(first.packed)).toEqual(content);
    const reused=packCachedContent(content,{previous:first.packed,receipt:first.receipt,codecIdentity:"encoder-a",encode:()=>{throw Error("unchanged content must not be recompressed");}});
    expect(reused.reused).toBe(true);expect(reused.packed).toBe(first.packed);
  });
  it("rebuilds changed content and changed encoder policies",()=>{
    const first=packCachedContent(content,{codecIdentity:"encoder-a"});
    const changed=packCachedContent({...content,code:"const price = 30;"},{previous:first.packed,receipt:first.receipt,codecIdentity:"encoder-a"});
    expect(changed.reused).toBe(false);expect(unpackContent(changed.packed)).toEqual({...content,code:"const price = 30;"});
    expect(packCachedContent(content,{previous:first.packed,receipt:first.receipt,codecIdentity:"encoder-b"}).reused).toBe(false);
  });
  it("never serves corrupt or mismatched cached payloads, even with a matching cache checksum",()=>{
    const first=packCachedContent(content,{codecIdentity:"encoder-a"});
    for(const previous of [{encoding:"gzip-base64",data:"broken"},packContent({code:"wrong source"})]){
      const receipt={...first.receipt,packedSha256:sha(previous)};
      const result=packCachedContent(content,{previous,receipt,codecIdentity:"encoder-a"});
      expect(result.reused).toBe(false);expect(unpackContent(result.packed)).toEqual(content);
    }
  });
  it("requires a source identity and never trusts a missing receipt",()=>{
    const previous=packContent(content);
    expect(packCachedContent(content,{previous,codecIdentity:"encoder-a"}).reused).toBe(false);
    expect(()=>packCachedContent(content)).toThrow("encoder identity");
  });
});
