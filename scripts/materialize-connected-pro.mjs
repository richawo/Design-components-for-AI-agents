#!/usr/bin/env node
// Materialize explicitly selected private blobs delivered by the already
// authorized GitHub connector. No network credentials, Git login or token copy.
// stdin: JSON lines {path,blob:{encoding:"base64",content,sha,size}}, then {finish:true}.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {writeConnectedBlob,verifyConnectedSnapshot} from "./lib/connected-pro-snapshot.mjs";
const [rootArg,manifestArg]=process.argv.slice(2);if(!rootArg||!manifestArg)throw new Error("Pass a new snapshot directory and pinned connector manifest");
const root=path.resolve(rootArg),manifest=JSON.parse(fs.readFileSync(manifestArg,"utf8"));
if(manifest.repository!=="richawo/Design-for-AI"||!/^[a-f0-9]{40}$/.test(manifest.commit)||!manifest.files?.length)throw new Error("Invalid pinned source manifest");
if(fs.existsSync(root)&&fs.readdirSync(root).length)throw new Error("Use an empty snapshot directory; never replace an existing checkout");
fs.mkdirSync(root,{recursive:true});const entries=new Map(manifest.files.map(e=>[e.path,e]));if(entries.size!==manifest.files.length)throw new Error("Duplicate manifest paths");
const saved=new Set();let bytes=0,complete=false;
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
 const item=JSON.parse(line);
 if(item.finish){
  if(saved.size!==entries.size)throw new Error(`Incomplete source delivery: ${saved.size}/${entries.size}`);
  const record={...manifest,complete:true};fs.writeFileSync(path.join(root,".connected-pro-snapshot.json"),JSON.stringify(record,null,2)+"\n");verifyConnectedSnapshot(root);
  // Read-only commit provenance for existing build scripts. This is explicitly
  // a connector snapshot, not an authenticated Git checkout or push credential.
  const git=path.join(root,".git");fs.mkdirSync(path.join(git,"objects"),{recursive:true});fs.mkdirSync(path.join(git,"refs"),{recursive:true});fs.writeFileSync(path.join(git,"HEAD"),manifest.commit+"\n");fs.writeFileSync(path.join(git,"config"),'[core]\nrepositoryformatversion = 0\nbare = true\n');
  console.log(JSON.stringify({complete:true,files:saved.size,bytes,commit:manifest.commit}));complete=true;break;
 }
 const entry=entries.get(item.path);if(!entry||saved.has(item.path))throw new Error("Unknown or repeated source path");bytes+=writeConnectedBlob(root,entry,item.blob);saved.add(item.path);
}
if(!complete)throw new Error("Snapshot stream ended without a verified finish");

if(complete)process.stdin.destroy();
