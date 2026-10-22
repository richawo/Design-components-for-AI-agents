#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {loadBlogSource} from "./lib/blog-source.mjs";
import {verifyPublicationRequest} from "./lib/publication-request.mjs";
import {verifyConnectedSnapshot} from "./lib/connected-pro-snapshot.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),privateRoot=path.join(root,"registry/pro"),approvalFile=path.join(privateRoot,"_site/publication/approved-batch.json");
// The signal contains hashes and owner IDs only. Existing Cloudflare Workers
// Builds watches the public repo; no GitHub Actions job or new secret is needed.
const paths=["_site/blog","_site/i18n","_site/assets","_site/config.json","_site/publication","_site/research"];
const connected=process.argv.includes("--connected-snapshot")?verifyConnectedSnapshot(privateRoot):null;
const dirty=connected?"":execFileSync("git",["status","--porcelain","--untracked-files=no","--",...paths],{cwd:privateRoot,encoding:"utf8"});
if(dirty.trim())throw new Error("Commit the publication source and approvals before requesting a build");
if(!connected)execFileSync("git",["ls-files","--error-unmatch","_site/publication/approved-batch.json"],{cwd:privateRoot,stdio:"ignore"});
const bytes=fs.readFileSync(approvalFile),approval=JSON.parse(bytes),request={version:2,requestId:approval.requestId,mode:approval.mode??"weekday",requestedAt:approval.requestedAt,privateContentCommit:connected?.commit??execFileSync("git",["rev-parse","HEAD"],{cwd:privateRoot,encoding:"utf8"}).trim(),sourceInputsSha256:approval.sourceInputsSha256,approvalSha256:createHash("sha256").update(bytes).digest("hex"),articleSlugs:approval.articles.map(a=>a.slug)};
verifyPublicationRequest(root,loadBlogSource(root).posts,request);
const output=path.join(root,"publication/content-request.json");fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(request,null,2)+"\n");
console.log(`Validated ${request.articleSlugs.length} owner approvals. Commit and push publication/content-request.json to request the normal Cloudflare production pipeline.`);
