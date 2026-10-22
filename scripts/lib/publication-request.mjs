import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gitBlobSha } from "./connected-pro-snapshot.mjs";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const read = file => fs.readFileSync(file);
const json = file => JSON.parse(read(file));
const ordered = values => [...values].sort((a,b)=>a<b?-1:a>b?1:0);
const files = (directory, prefix="") => fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=> {
  if(entry.isSymbolicLink()) throw new Error("Publication inputs cannot contain symlinks");
  const name=path.posix.join(prefix,entry.name);
  return entry.isDirectory()?files(path.join(directory,entry.name),name):[name];
});
const sealInputs = records => ({sha256:sha(JSON.stringify(records.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0))),files:records});
export function publicationInputsFromGitTree(tree) {
  if(tree.truncated||!Array.isArray(tree.tree))throw new Error("A complete pinned Git tree is required");
  const records=[];
  for(const entry of tree.tree){
    if(!/^_site\/(?:blog\/.+|i18n\/.+|assets\/.+|config\.json)$/.test(entry.path))continue;
    if(entry.type==="tree")continue;
    if(entry.type!=="blob"||!["100644","100755"].includes(entry.mode)||!/^[a-f0-9]{40}$/.test(entry.sha)||entry.path.split("/").some(p=>p===".."||p==="."))throw new Error("Invalid publication tree entry");
    records.push([entry.path.slice(6),entry.sha]);
  }
  if(!records.some(([p])=>p==="config.json")||["blog/","i18n/","assets/"].some(prefix=>!records.some(([p])=>p.startsWith(prefix))))throw new Error("Publication tree inputs are missing");
  if(new Set(records.map(([p])=>p)).size!==records.length)throw new Error("Duplicate publication tree path");
  return sealInputs(records);
}
export function publicationInputs(root) {
  const base=path.join(root,"registry/pro/_site"),records=[];
  for(const directory of ["blog","i18n","assets"]){
    const target=path.join(base,directory);
    if(!fs.existsSync(target))throw new Error("Missing private publication input: "+directory);
    for(const name of ordered(files(target)))records.push([directory+"/"+name,gitBlobSha(read(path.join(target,name)))]);
  }
  records.push(["config.json",gitBlobSha(read(path.join(base,"config.json")))]);
  return sealInputs(records);
}
export function londonDay(iso) {
  const date=new Date(iso);if(!Number.isFinite(date.getTime()))throw new Error("Invalid publication date");
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
export function assertPublicationDay({requestedAt,mode,articleSlugs},posts) {
  const day=londonDay(requestedAt),weekday=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/London",weekday:"short"}).format(new Date(requestedAt));
  if(!["weekday","manual"].includes(mode))throw new Error("Unknown publication mode");
  if(mode==="weekday"&&["Sat","Sun"].includes(weekday))throw new Error("Weekday publication cannot run at the weekend");
  if(!Array.isArray(articleSlugs)||!articleSlugs.length||articleSlugs.length>5||new Set(articleSlugs).size!==articleSlugs.length)throw new Error("Publication needs one to five distinct owners");
  const dateOf=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
  const today=posts.filter(p=>!p.data.draft&&dateOf(p.data.date)===day);
  if(today.length>5)throw new Error("London daily ceiling exceeded across publication requests");
  return {day,newArticlesOnDay:today.length};
}
export function verifyPublicationRequest(root,posts,providedRequest) {
  const file=path.join(root,"publication/content-request.json");
  if(!providedRequest&&!fs.existsSync(file)){
    if(fs.existsSync(path.join(root,"registry/pro/_site/publication/approved-batch.json")))throw new Error("Approved editorial source requires its matching public publication request");
    return null;
  }
  const request=providedRequest??json(file),base=path.join(root,"registry/pro/_site");
  if(request.version!==2||!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(request.requestId)||!/^[a-f0-9]{40}$/.test(request.privateContentCommit))throw new Error("Invalid publication request identity");
  const inputs=publicationInputs(root);
  if(request.sourceInputsSha256!==inputs.sha256)throw new Error("Publication inputs changed after approval");
  const approvalFile=path.join(base,"publication/approved-batch.json");
  if(sha(read(approvalFile))!==request.approvalSha256)throw new Error("Publication approval does not match the request");
  const approval=json(approvalFile),rulesFile=path.join(base,"research/EDITORIAL_RULES.md"),rulebook=read(rulesFile);
  if(approval.scope!=="prepublication"||approval.requestId!==request.requestId||approval.sourceInputsSha256!==inputs.sha256||approval.rulebookSha256!==sha(rulebook))throw new Error("Publication approval is stale");
  const ids=[...rulebook.toString().matchAll(/^\|[^|\n]*\b(DFA-R\d+)\b[^|\n]*\|/gm)].map(m=>m[1]);
  if(!ids.length||new Set(ids).size!==ids.length)throw new Error("Invalid current rulebook IDs");
  const day=assertPublicationDay(request,posts);
  if(!Array.isArray(approval.articles)||approval.articles.length!==request.articleSlugs.length)throw new Error("Missing article approvals");
  for(const slug of request.articleSlugs){
    const post=posts.find(p=>p.data.slug===slug&&!p.data.draft),entry=approval.articles.find(a=>a.slug===slug);
    if(!post||!entry||entry.sourceSha256!==sha(Buffer.from(post.raw)))throw new Error("Article source changed after approval: "+slug);
    if(!entry.review.startsWith("research/")||entry.review.includes("..")||path.isAbsolute(entry.review))throw new Error("Review must stay in private research");
    const reviewFile=path.join(base,entry.review),review=json(reviewFile);
    if(sha(read(reviewFile))!==entry.reviewSha256||review.sourceSha256!==entry.sourceSha256||review.rulebookSha256!==approval.rulebookSha256||review.sourceInputsSha256!==inputs.sha256)throw new Error("Article review is stale: "+slug);
    const deliveryChecks=["build-marker","editions","metadata","assets","discovery","mcp","license-guards"];
    const planned=review.deliveryPlan?.requestId===request.requestId&&deliveryChecks.every(check=>review.deliveryPlan.checks?.includes(check))&&review.deliveryPlan.onFailure?.trim();
    const building=review.executionPlan?.executor==="Cloudflare Workers Builds"&&["source-locales","strict-registry","types","tests","production-build"].every(id=>review.executionPlan.checks?.includes(id));
    const passes=r=>r.reason?.trim()&&r.evidence&&(["pass","not applicable"].includes(r.verdict)||(r.verdict==="pending"&&r.phase==="delivery"&&["DFA-R30","DFA-R37"].includes(r.id)&&planned)||(r.verdict==="pending"&&r.id==="DFA-R29"&&r.phase==="build"&&building));
    if(!Array.isArray(review.rules)||review.rules.length!==ids.length||new Set(review.rules.map(r=>r.id)).size!==ids.length||ids.some(id=>!review.rules.some(r=>r.id===id&&passes(r))))throw new Error("Missing, failed or pending current rule: "+slug);
    if(!Array.isArray(review.resultReviews)||review.resultReviews.length<5||review.resultReviews.length>10||new Set(review.resultReviews.map(r=>r.url)).size!==review.resultReviews.length||review.resultReviews.some(r=>!/^https:\/\//.test(r.url)||!r.analysis?.trim()||!r.readOn))throw new Error("Five to ten substantive result reviews are required: "+slug);
  }
  return {requestId:request.requestId,sourceInputsSha256:inputs.sha256,privateContentCommit:request.privateContentCommit,...day,articleSlugs:request.articleSlugs};
}
