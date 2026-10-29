// Exercise licensed drawing through the real material API. No private source fixture is bundled.
import assert from "node:assert/strict";
import fs from "node:fs";
import {launchChromium} from "../../scripts/lib/browser.mjs";

const base=process.env.TEST_BASE||"http://127.0.0.1:4189",license=process.env.TEST_STYLE_LICENSE;
if(!license)throw Error("Set TEST_STYLE_LICENSE to a Pro key scoped to TEST_BASE.");
const out=process.env.TEST_OUT||"test-results/crayon-writing";fs.mkdirSync(out,{recursive:true});
const browser=await launchChromium({args:[]});
try{
 const context=await browser.newContext({viewport:{width:900,height:600}});
 await context.addCookies([{name:"dfa_license",value:license,url:base,httpOnly:true,sameSite:"Lax",secure:new URL(base).protocol==="https:"}]);
 const response=await context.request.get(base+"/api/styles/hero-swiss-grid");assert.equal(response.status(),200);
 const material=await response.json();assert(material.runtimeUrl,"This check requires licensed drawing material.");
 const page=await context.newPage(),fontUrl=new URL(new URL(material.font.url).pathname,base).href;
 const css=material.css.replaceAll(material.font.url,fontUrl);
 await page.route("**/__crayon_writing_check__",route=>route.fulfill({contentType:"text/html",body:'<!doctype html><style>'+css+'</style><main id="subject" data-dfa-style="crayon" data-dfa-theme="light" style="padding:40px"><h1 style="font-size:64px;line-height:1.15;margin:0">Made by hand.<br>Built to work.</h1><h2 style="font-size:30px">$1,420.38</h2><button style="padding:12px;border:1px solid #171719">Open canvas</button></main>'}));
 await page.goto(base+"/__crayon_writing_check__");await page.evaluate(()=>document.fonts.load('700 64px "DFA Crayon"'));
 const mount=()=>page.evaluate(async url=>{const{DFAMountCrayon}=await import(url);window.__releaseInk=DFAMountCrayon(document.querySelector("#subject"),{slug:"writing-check",category:"app"});},base+material.runtimeUrl);
 await mount();await page.locator("[data-dfa-ink-ready=true]").waitFor({state:"attached"});await page.waitForTimeout(60);
 const initial=await page.evaluate(()=>({masks:document.querySelectorAll("[data-dfa-ink-writing]").length,numericMasked:document.querySelector("h2").hasAttribute("data-dfa-ink-writing"),text:document.querySelector("h1").textContent,height:document.querySelector("h1").clientHeight}));
 assert.equal(initial.masks,1,"the initial resize notification must not cancel the write-on");assert.equal(initial.numericMasked,false,"live values must stay immediately readable");
 await page.screenshot({path:out+"/060ms.png"});await page.waitForTimeout(360);await page.screenshot({path:out+"/420ms.png"});await page.waitForTimeout(1400);
 assert.equal(await page.locator("[data-dfa-ink-writing]").count(),0);assert.equal(await page.locator("h1").textContent(),initial.text);assert.equal(await page.locator("h1").evaluate(node=>node.clientHeight),initial.height);
 await page.screenshot({path:out+"/finished.png"});await page.evaluate(()=>window.__releaseInk());assert.equal(await page.locator("[data-dfa-ink]").count(),0);
 await mount();await page.locator("[data-dfa-ink-ready=true]").waitFor({state:"attached"});await page.setViewportSize({width:390,height:600});await page.waitForTimeout(100);assert.equal(await page.locator("[data-dfa-ink-writing]").count(),0,"resizing releases an obsolete mask");
 await page.evaluate(()=>window.__releaseInk());await page.emulateMedia({reducedMotion:"reduce"});await mount();await page.locator("[data-dfa-ink-ready=true]").waitFor({state:"attached"});assert.equal(await page.locator("[data-dfa-ink-writing]").count(),0);
 const report={runtimeSha256:material.runtimeSha256,initial,textAndLayoutPreserved:true,finishedMasks:0,cleanupDecorations:0,reducedMotionMasks:0};fs.writeFileSync(out+"/report.json",JSON.stringify(report,null,2));console.log("Write-on survives initial layout; resizing, unmounting and reduced motion release its masks.");
}finally{await browser.close();}
