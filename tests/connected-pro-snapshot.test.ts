import fs from "node:fs";import os from "node:os";import path from "node:path";import{afterEach,describe,expect,it}from"vitest";
import{spawn}from"node:child_process";
import{gitBlobSha,snapshotPath,writeConnectedBlob,verifyConnectedSnapshot}from"../scripts/lib/connected-pro-snapshot.mjs";
const roots:string[]=[];const fixture=()=>{const p=fs.mkdtempSync(path.join(os.tmpdir(),"dfa-snapshot-"));roots.push(p);return p};afterEach(()=>{for(const p of roots.splice(0))fs.rmSync(p,{recursive:true,force:true})});
describe("connector source snapshots",()=>{
 it("preserves binary and non-Latin source exactly, checking Git blob identity",()=>{const root=fixture();for(const [name,bytes]of [["cover.bin",Buffer.from([0,255,4,200])],["guide.md",Buffer.from("مرحبا\n日本語")]]as const){const sha=gitBlobSha(bytes);writeConnectedBlob(root,{path:name,sha,type:"blob",mode:"100644"},{sha,size:bytes.length,encoding:"base64",content:bytes.toString("base64")});expect(fs.readFileSync(path.join(root,name))).toEqual(bytes)}});
 it("rejects corrupt content, unsafe paths and symlink entries",()=>{const root=fixture(),bytes=Buffer.from("source"),entry={path:"file.tsx",sha:gitBlobSha(bytes),type:"blob",mode:"100644"};expect(()=>writeConnectedBlob(root,entry,{encoding:"base64",content:Buffer.from("wrong").toString("base64")})).toThrow("identity mismatch");for(const name of ["../secret","/tmp/secret","a/../secret","a\\secret",".git/../HEAD",".git/HEAD",".connected-pro-snapshot.json"])expect(()=>snapshotPath(root,name)).toThrow();expect(()=>writeConnectedBlob(root,{...entry,mode:"120000"},{encoding:"base64",content:bytes.toString("base64")})).toThrow("regular")});
 it("rejects a missing or altered snapshot instead of treating connector reads as a checkout",()=>{const root=fixture();fs.writeFileSync(path.join(root,".connected-pro-snapshot.json"),JSON.stringify({repository:"richawo/Design-for-AI",commit:"a".repeat(40),complete:false,files:[]}));expect(()=>verifyConnectedSnapshot(root)).toThrow("Incomplete")});
 it("finishes a connector stream without waiting for the caller to close stdin",async()=>{
  const root=fixture(),target=path.join(root,"pro");
  const inputs={"AGENTS.md":"rules","_site/config.json":"{}","_site/blog/guide.md":"guide","_site/i18n/strings/fr.json":"{}"};
  const entries=Object.entries(inputs).map(([name,text])=>({path:name,type:"blob",mode:"100644",sha:gitBlobSha(Buffer.from(text))}));
  const manifest={repository:"richawo/Design-for-AI",commit:"a".repeat(40),files:entries},file=path.join(root,"manifest.json");fs.writeFileSync(file,JSON.stringify(manifest));
  const child=spawn(process.execPath,[path.resolve(import.meta.dirname,"../scripts/materialize-connected-pro.mjs"),target,file],{stdio:["pipe","pipe","pipe"]});
  let output="",error="";child.stdout.on("data",x=>output+=x);child.stderr.on("data",x=>error+=x);
  const ended=new Promise<number|null>((resolve,reject)=>{const timeout=setTimeout(()=>{child.kill();reject(new Error("Snapshot process did not finish: "+error))},4000);child.once("exit",code=>{clearTimeout(timeout);resolve(code)})});
  for(const entry of entries){const bytes=Buffer.from(inputs[entry.path as keyof typeof inputs]);child.stdin.write(JSON.stringify({path:entry.path,blob:{sha:entry.sha,size:bytes.length,encoding:"base64",content:bytes.toString("base64")}})+"\n")};
  child.stdin.write('{"finish":true}\n');expect(await ended).toBe(0);expect(JSON.parse(output).complete).toBe(true);expect(verifyConnectedSnapshot(target).commit).toBe(manifest.commit);
  fs.writeFileSync(path.join(target,"_site/blog/uncommitted.md"),"extra");expect(()=>verifyConnectedSnapshot(target)).toThrow("Uncommitted extra");
 });

});
