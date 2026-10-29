import {afterEach,describe,expect,it} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {loadStylePack,materializeStyleSource,styleSourceIdentity,styleSourcePin} from "../scripts/lib/style-source.mjs";

const roots:string[]=[];
const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"dfa-style-pin-"));roots.push(root);
 const pro=path.join(root,"registry/pro"),dir=path.join(pro,"_styles/crayon");fs.mkdirSync(dir,{recursive:true});
 const files={"manifest.json":JSON.stringify({id:"crayon",tier:"pro",appearance:"light"}),"style.css":"/* licensed fixture */","prompt.md":"Preserve keyboard behavior."};
 for(const[name,content]of Object.entries(files))fs.writeFileSync(path.join(dir,name),content);
 const git=(...args:string[])=>execFileSync("git",["-C",pro,...args],{encoding:"utf8"}).trim();
 git("init","--quiet");git("add","_styles");git("-c","user.name=Local QA","-c","user.email=qa@example.invalid","commit","--quiet","-m","Fixture material");
 const pin={repository:"richawo/Design-for-AI",commit:git("rev-parse","HEAD"),files:Object.entries(files).map(([name,content])=>({path:"_styles/crayon/"+name,sha256:sha(content)}))};
 fs.writeFileSync(path.join(root,"registry/style-source.json"),JSON.stringify(pin));
 return{root,pro,dir,pin,git};
}
afterEach(()=>{for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true});});
describe("independently pinned paid style material",()=>{
 it("materializes the approved blobs without changing the developer checkout or editorial files",()=>{
  const f=fixture();fs.writeFileSync(path.join(f.dir,"style.css"),"Unfinished private edit");
  fs.mkdirSync(path.join(f.pro,"_site/blog"),{recursive:true});fs.writeFileSync(path.join(f.pro,"_site/blog/draft.md"),"Keep this draft");
  const before=f.git("status","--porcelain");const dest=materializeStyleSource(f.root,f.pro,f.pin);
  expect(fs.readFileSync(path.join(dest,"style.css"),"utf8")).toBe("/* licensed fixture */");
  expect(f.git("status","--porcelain")).toBe(before);expect(f.git("rev-parse","HEAD")).toBe(f.pin.commit);
  expect(loadStylePack(f.root)?.css).toBe("/* licensed fixture */");expect(styleSourceIdentity(f.root)?.available).toBe(true);
 });
 it("rejects an unexpected path or corrupted blob before creating style output",()=>{
  const f=fixture();const bad={...f.pin,files:f.pin.files.map((file,i)=>i?file:{...file,sha256:"0".repeat(64)})};
  expect(()=>materializeStyleSource(f.root,f.pro,bad)).toThrow("hash mismatch");
  expect(fs.existsSync(path.join(f.root,"registry/__generated__/style-inputs"))).toBe(false);
  fs.writeFileSync(path.join(f.root,"registry/style-source.json"),JSON.stringify({...f.pin,files:[...f.pin.files.slice(1),{path:"_site/blog/draft.md",sha256:"0".repeat(64)}]}));
  expect(()=>styleSourcePin(f.root)).toThrow("Invalid private visual-style source pin");
 });
 it("permits a public checkout without private material but records that it is unavailable",()=>{
  const f=fixture();fs.rmSync(f.pro,{recursive:true,force:true});
  expect(loadStylePack(f.root)).toBeNull();expect(styleSourceIdentity(f.root)).toMatchObject({commit:f.pin.commit,available:false});
 });
 it("rejects changed material after a source pin was approved",()=>{
  const f=fixture();fs.writeFileSync(path.join(f.dir,"style.css"),"Changed after approval");
  expect(()=>loadStylePack(f.root)).toThrow("differ from their committed pin");
 });
 it("accepts a numeric preview version and rejects paths masquerading as versions",()=>{
  const f=fixture(),file=path.join(f.root,"registry/style-source.json");
  fs.writeFileSync(file,JSON.stringify({...f.pin,previewVersion:3}));expect(styleSourcePin(f.root)?.previewVersion).toBe(3);
  for(const previewVersion of ["../private",1,2.5]){fs.writeFileSync(file,JSON.stringify({...f.pin,previewVersion}));expect(()=>styleSourcePin(f.root)).toThrow("Invalid visual-style preview version");}
 });
 it('pins both drawing runtimes and rejects incomplete or changed runtime material',()=>{
  const f=fixture();const manifest=JSON.stringify({id:'crayon',tier:'pro',appearance:'light',version:4,palette:{ink:'#171719'},themes:{light:{ink:'#171719'},dark:{ink:'#ededef'}}});
  fs.writeFileSync(path.join(f.dir,'manifest.json'),manifest);
  const runtime={'web.ts':'export function DFAMountCrayon(root:Element){return ()=>{}}','native.tsx':'// Native ink fixture'};
  for(const[name,value]of Object.entries(runtime))fs.writeFileSync(path.join(f.dir,name),value);
  f.git('add','_styles');f.git('-c','user.name=Local QA','-c','user.email=qa@example.invalid','commit','--quiet','-m','Drawing material');
  const pin={...f.pin,commit:f.git('rev-parse','HEAD'),files:[...f.pin.files.map(file=>file.path.endsWith('manifest.json')?{...file,sha256:sha(manifest)}:file),...Object.entries(runtime).map(([name,value])=>({path:'_styles/crayon/'+name,sha256:sha(value)}))]};
  const file=path.join(f.root,'registry/style-source.json');fs.writeFileSync(file,JSON.stringify(pin));
  expect(styleSourcePin(f.root)?.files).toHaveLength(5);materializeStyleSource(f.root,f.pro,pin);const loaded=loadStylePack(f.root);expect(loaded?.webModule).toContain('function DFAMountCrayon(root)');expect(loaded?.nativeRuntime).toContain('Native ink');
  fs.writeFileSync(file,JSON.stringify({...pin,files:pin.files.slice(0,4)}));expect(()=>styleSourcePin(f.root)).toThrow('Invalid private visual-style source pin');
 });
});
