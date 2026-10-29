import {describe,expect,it} from "vitest";
import {makeStyledSource} from "../scripts/lib/component-styles.mjs";
import {packStyleSource,restoreStyleSource,sharedStyleText,type StyleDelta} from "../scripts/lib/style-delta.mjs";
import type {ComponentSource} from "../lib/registry-types";
import {unpackContent} from "../scripts/lib/content-pack.mjs";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
const material={css:"/* licensed material */",prompt:"Keep interactions.",appearance:"light",font:{family:"Hand",url:"https://example.invalid/font",weight:"400 700"},palette:{surface:"#fff8e7",page:"#f6edda",ink:"#2d3027",muted:"#675b49"}};
describe("small, source-bound style packs",()=>{
 it("binds every generated variant to the source the runtime actually serves, including composed blocks",()=>{
  const generated=path.resolve("registry/__generated__"),styles=path.join(generated,"style-packs");
  if(!fs.existsSync(styles))return; // Public clones without private material have no variants.
  for(const file of fs.readdirSync(styles).filter(file=>file.endsWith(".json"))){
   const delta=unpackContent(JSON.parse(fs.readFileSync(path.join(styles,file),"utf8"))) as StyleDelta;
   const base=unpackContent(JSON.parse(fs.readFileSync(path.join(generated,"source-packs",file),"utf8"))) as ComponentSource;
   expect(createHash("sha256").update(base.code).digest("hex"),file).toBe(delta.baseCodeSha256);
   const shared=delta.format==="dfa-style-delta-v2"?unpackContent(JSON.parse(fs.readFileSync(path.join(generated,"style-shared.json"),"utf8"))) as Record<string,string>:null;
   expect(()=>restoreStyleSource(base,delta,shared),file).not.toThrow();
  }
 });
 it.each(["web","mobile"])("restores the exact %s source and briefs without storing another complete component",platform=>{
  const code=platform==="web"?'export const Widget=({onClick})=> <button onClick={onClick}>Click</button>':'import {View,Text,StyleSheet} from "react-native"; export function Widget(){return <View><Text style={s.heading}>Hello</Text></View>} const s=StyleSheet.create({heading:{fontSize:28,color:"#fff"}});';
  const base={slug:"test",code,prompt:"Original brief.\n",promptJson:'{"purpose":"Test"}'};
  const variant=makeStyledSource({slug:"test",platform,usage:"<Widget/>"},base,material)!;
  const delta=packStyleSource(base,variant),restored=restoreStyleSource(base,delta);
  for(const field of ["code","prompt","promptJson","styleCss","font"] as const)expect(restored[field]).toEqual(variant[field]);
  expect(JSON.stringify(delta)).not.toContain('export function Widget');
 });
 it("rejects a patch for another component version instead of returning corrupted source",()=>{
  const base={slug:"test",code:'export function Widget(){return <section>Hello</section>}',prompt:"Base",promptJson:"{}"};
  const delta=packStyleSource(base,makeStyledSource({slug:"test",platform:"web",usage:"<Widget/>"},base,material)!);
  expect(()=>restoreStyleSource({...base,code:base.code+"\n"},delta)).toThrow("does not match");
  expect(()=>restoreStyleSource({...base,slug:"other"},delta)).toThrow("does not match");
  expect(()=>restoreStyleSource(base,{...delta,codeEdits:[{at:-1,end:0,text:"bad"}]})).toThrow("Invalid compiled style edit");
 });
 it("shares paid drawing material once while restoring exact standalone source and runtime",()=>{
  const runtime='export function DFAMountCrayon(root:Element){return ()=>root.removeAttribute("data-dfa-ink")}';
  const pack={...material,css:'/* texture */'.repeat(200),webRuntime:runtime,webModule:runtime.replace(':Element',''),nativeRuntime:'// native drawing material\n'.repeat(100)};
  const base={slug:'test',code:'export function Widget(){return <section><h1>Hello</h1></section>}',prompt:'Base',promptJson:'{}'};
  const variant=makeStyledSource({slug:'test',platform:'web',usage:'<Widget/>'},base,pack)!;
  const shared=sharedStyleText(pack)!,delta=packStyleSource(base,variant,shared),restored=restoreStyleSource(base,delta,shared);
  expect(delta.format).toBe('dfa-style-delta-v2');
  for(const key of ['code','prompt','promptJson','styleCss','styleRuntime','styleRuntimeSha256','styleOptions'] as const)expect(restored[key]).toEqual(variant[key]);
  expect(JSON.stringify(delta)).not.toContain('texture');expect(JSON.stringify(delta)).not.toContain('function DFAMountCrayon');
  expect(()=>restoreStyleSource(base,delta,{...shared,css:'Changed material'})).toThrow('shared material');
  expect(()=>restoreStyleSource(base,delta)).toThrow('shared material');
 });
});
