import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {styleSourceIdentity} from "./style-source.mjs";
import {publicationInputs} from "./publication-request.mjs";
export const BUILD_CHECKS=["source-locales","strict-registry","types","tests","production-build"];
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
export function publicationBuildIdentity(root){
 const pro=path.join(root,"registry/pro"),request=path.join(root,"publication/content-request.json");
 return {visualStyleSource:styleSourceIdentity(root),publicCommit:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),privateCommit:execFileSync("git",["rev-parse","HEAD"],{cwd:pro,encoding:"utf8"}).trim(),sourceInputsSha256:publicationInputs(root).sha256,rulebookSha256:hash(fs.readFileSync(path.join(pro,"_site/research/EDITORIAL_RULES.md"))),requestSha256:fs.existsSync(request)?hash(fs.readFileSync(request)):null};
}
export function validatePublicationBuildReceipt(receipt,identity){
 if(receipt.version!==1||!/^v24\./.test(receipt.node)||!receipt.finishedAt||JSON.stringify(receipt.identity)!==JSON.stringify(identity))throw new Error("Publication build receipt is missing or stale");
 if(!Array.isArray(receipt.checks)||receipt.checks.length!==BUILD_CHECKS.length||BUILD_CHECKS.some((id,i)=>receipt.checks[i]?.id!==id||receipt.checks[i]?.exitCode!==0))throw new Error("Required publication production checks did not pass");
 return receipt;
}
export function assertPublicationBuildReceipt(root){
 if(!fs.existsSync(path.join(root,"publication/content-request.json")))return null;
 return validatePublicationBuildReceipt(JSON.parse(fs.readFileSync(path.join(root,".open-next/publication-checks.json"),"utf8")),publicationBuildIdentity(root));
}
