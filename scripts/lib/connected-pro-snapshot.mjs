import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
export const gitBlobSha=bytes=>createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
export function snapshotPath(root,relative){
 if(typeof relative!=="string"||!relative||relative.includes("\\")||relative.split("/").some(p=>!p||p==="."||p==="..")||path.isAbsolute(relative))throw new Error("Unsafe snapshot path");
 if(relative.split("/").includes(".git")||relative===".connected-pro-snapshot.json")throw new Error("Reserved snapshot path");
 const target=path.join(root,relative);let current=root;
 for(const part of relative.split("/").slice(0,-1)){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw new Error("Snapshot directory cannot be a symlink")}
 if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw new Error("Snapshot file cannot be a symlink");
 return target;
}
export function writeConnectedBlob(root,entry,blob){
 if(!["100644","100755"].includes(entry.mode)||entry.type!=="blob")throw new Error("Only regular source files are accepted");
 if(blob.encoding!=="base64"||typeof blob.content!=="string")throw new Error("Use GitHub's base64 Git blob response");
 const bytes=Buffer.from(blob.content.replace(/\s/g,""),"base64");
 if(gitBlobSha(bytes)!==entry.sha||(blob.sha&&blob.sha!==entry.sha)||(blob.size!==undefined&&bytes.length!==blob.size))throw new Error("Connected blob identity mismatch: "+entry.path);
 const target=snapshotPath(root,entry.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{mode:entry.mode==="100755"?0o755:0o644});
 return bytes.length;
}
export function verifyConnectedSnapshot(root){
 const snapshot=JSON.parse(fs.readFileSync(path.join(root,".connected-pro-snapshot.json"),"utf8"));
 if(snapshot.repository!=="richawo/Design-for-AI"||!/^[a-f0-9]{40}$/.test(snapshot.commit)||snapshot.complete!==true||!snapshot.files?.length)throw new Error("Incomplete connected source snapshot");
 const names=new Set();
 for(const entry of snapshot.files){if(names.has(entry.path))throw new Error("Duplicate snapshot path");names.add(entry.path);const bytes=fs.readFileSync(snapshotPath(root,entry.path));if(gitBlobSha(bytes)!==entry.sha)throw new Error("Snapshot source changed: "+entry.path)}
 if(!names.has("AGENTS.md")||!names.has("_site/config.json")||![...names].some(n=>n.startsWith("_site/blog/"))||![...names].some(n=>n.startsWith("_site/i18n/")))throw new Error("Snapshot publication inputs are missing");
 const inspect=(directory,prefix="")=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(!prefix&&[".git",".connected-pro-snapshot.json"].includes(entry.name))continue;const relative=prefix?prefix+"/"+entry.name:entry.name;if(entry.isSymbolicLink())throw new Error("Unexpected snapshot symlink");if(entry.isDirectory())inspect(path.join(directory,entry.name),relative);else if(!names.has(relative))throw new Error("Uncommitted extra snapshot file: "+relative)}};
 inspect(root);
 return snapshot;
}
