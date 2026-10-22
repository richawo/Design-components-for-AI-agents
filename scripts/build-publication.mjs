#!/usr/bin/env node
// Cloudflare is the authorized full-source executor. All mandatory checks finish
// before deployment, and the receipt binds them to the request and source inputs.
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {publicationBuildIdentity,BUILD_CHECKS} from "./lib/publication-build.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),receiptFile=path.join(root,".open-next/publication-checks.json");
if(!/^v24\./.test(process.version))throw new Error("Publication builds require Node 24");
fs.rmSync(receiptFile,{force:true});
const commands=[
 ["npm",["run","blog:audit","--","--require-source","--require-locales"]],
 [process.execPath,["scripts/build-registry.mjs","--strict"]],
 ["npm",["run","typecheck"]],
 ["npm",["test"]],
 [path.join(root,"node_modules/.bin/opennextjs-cloudflare"),["build"]],
];
const identity=publicationBuildIdentity(root),checks=[];
for(let i=0;i<commands.length;i++){
 const [command,args]=commands[i],started=Date.now();
 execFileSync(command,args,{cwd:root,stdio:"inherit"});
 checks.push({id:BUILD_CHECKS[i],command:[command===process.execPath?"node":command,...args],exitCode:0,milliseconds:Date.now()-started});
}
if(JSON.stringify(identity)!==JSON.stringify(publicationBuildIdentity(root)))throw new Error("Publication sources changed during production checks");
fs.mkdirSync(path.dirname(receiptFile),{recursive:true});fs.writeFileSync(receiptFile,JSON.stringify({version:1,node:process.version,identity,checks,finishedAt:new Date().toISOString()},null,2)+"\n");
console.log("Publication build: all five required check stages passed for the exact source and request.");
