// Exercise the licensed installation itself, without the site's native palette adapter.
// TEST_BASE=<prepared Worker> TEST_STYLE_LICENSE=<local fixture> node tests/browser/crayon-native-source-themes.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base=process.env.TEST_BASE||"http://127.0.0.1:4189",license=process.env.TEST_STYLE_LICENSE;
if(!license)throw new Error("Set TEST_STYLE_LICENSE to a Pro key scoped to TEST_BASE.");
const out=process.env.TEST_OUT||"test-results/crayon-native-source-themes";
fs.mkdirSync(out,{recursive:true});
const root=process.cwd(),browser=await launchChromium();
const context=await browser.newContext({viewport:{width:390,height:1000},reducedMotion:"reduce"});
await context.addCookies([{name:"dfa_license",value:license,url:base,httpOnly:true,sameSite:"Lax",secure:new URL(base).protocol==="https:"}]);
const page=await context.newPage(),report=[],errors=[];
page.on("pageerror",error=>errors.push(error.message));
const rgb=hex=>`rgb(${[0,2,4].map(at=>parseInt(hex.slice(at+1,at+3),16)).join(", ")})`;
try{
 for(const slug of ["mobile-settings","mobile-agent-approval","mobile-swipe-list"]){
  for(const installed of ["light","dark"]){
   const response=await context.request.get(`${base}/api/registry/${slug}?visualStyle=crayon&theme=${installed}`);
   assert.equal(response.status(),200);assert(response.headers()["cache-control"].includes("no-store"));
   const source=await response.json();assert.equal(source.theme,installed);
   const palettes=source.promptJson.visualStyle.themes;
   const compiled=await build({
    stdin:{contents:`import React,{useState} from "react";import {createRoot} from "react-dom/client";import * as Subject from "dfa-styled-subject";function App(){const[theme,setTheme]=useState(null);return <><div><button data-test-theme="light" onClick={()=>setTheme("light")}>Light</button><button data-test-theme="dark" onClick={()=>setTheme("dark")}>Dark</button></div><Subject.default {...(theme?{theme}:{})}/></>}createRoot(document.getElementById("root")).render(<App/>);`,resolveDir:root,loader:"tsx"},
    plugins:[{name:"licensed-native-subject",setup(builder){builder.onResolve({filter:/^dfa-styled-subject$/},()=>({path:slug,namespace:"licensed-native"}));builder.onLoad({filter:/.*/,namespace:"licensed-native"},()=>({contents:source.code,loader:"tsx",resolveDir:root}));}}],
    bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",
    define:{"process.env.NODE_ENV":'"production"',__DEV__:"false",global:"globalThis"},
    alias:{"react-native":"react-native-web","@react-native/assets-registry/registry":path.join(root,"lib/shims/assets-registry.js")},
    resolveExtensions:[".web.tsx",".tsx",".web.ts",".ts",".web.jsx",".jsx",".web.js",".js",".json"],
   });
   await page.route("**/__crayon_native_source__",route=>route.fulfill({contentType:"text/html",body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Native source theme review</title></head><body style="margin:0"><main id="root" style="display:flex;flex-direction:column;width:390px;min-height:844px"></main></body></html>'}));
   await page.goto(`${base}/__crayon_native_source__`);await page.addScriptTag({content:compiled.outputFiles[0].text});
   const heading=slug==="mobile-agent-approval"?page.getByText("Ship billing-api to production",{exact:true}):page.locator('[role="heading"]').first();await heading.waitFor();
   const colors=[];
   for(const choice of [null,"light","dark"]){
    if(choice)await page.locator(`[data-test-theme="${choice}"]`).click();
    const expected=choice??installed;
    const ink=await heading.evaluate(node=>getComputedStyle(node).color);
    assert.equal(ink,rgb(palettes[expected].ink),`${slug}: ${choice??"installation-default"} uses the selected palette`);
    colors.push({choice:choice??"installation-default",theme:expected,ink});
   }
   await page.screenshot({path:`${out}/${slug}-${installed}.png`});
   report.push({slug,installed,colors});await page.unroute("**/__crayon_native_source__");
  }
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({report,errors},null,2));
 console.log("Native installations preserve both defaults and explicit theme prop changes.");
}catch(error){fs.writeFileSync(`${out}/report.json`,JSON.stringify({report,errors,error:error.message},null,2));throw error;}
finally{await browser.close();}
