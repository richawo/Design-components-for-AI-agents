// Calculated accent labels and fixed shader artwork retain their own contrast.
import assert from "node:assert/strict";
import fs from "node:fs";
import {launchChromium} from "../../scripts/lib/browser.mjs";

const base=process.env.TEST_BASE||"http://127.0.0.1:4189",license=process.env.TEST_STYLE_LICENSE;
if(!license)throw Error("Set TEST_STYLE_LICENSE to a Pro key scoped to TEST_BASE");
const out=process.env.TEST_OUT||"test-results/crayon-painted-contrast";fs.mkdirSync(out,{recursive:true});
const luma=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luma(a),y=luma(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const browser=await launchChromium({args:[]}),report=[];
try{
 for(const theme of ["light","dark"]){
  const context=await browser.newContext({viewport:{width:1000,height:900},reducedMotion:"reduce"});
  await context.addCookies([{name:"dfa_license",value:license,url:base,httpOnly:true,sameSite:"Lax",secure:new URL(base).protocol==="https:"}]);
  for(const slug of ["button-magnetic","bg-grain-gradient","three-keycaps","three-contour-terrain","hero-prism","three-globe-arcs","three-particle-sphere","three-wave-field","three-holo-card","three-voice-orb","three-ascii-object","footer-ascii-wordmark","effect-border-tracer","footer-columns-status"]){
   const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(base+"/preview/"+slug+"?visualStyle=crayon&theme="+theme,{waitUntil:"load"});
   await page.locator('[data-dfa-ink-ready="true"]').first().waitFor();
   const colors=slug==="button-magnetic"
    ?await page.getByRole("button",{name:/Start building/}).evaluate(el=>({ink:getComputedStyle(el).color,paint:getComputedStyle(el).backgroundColor}))
    :slug==="bg-grain-gradient"
    ?await page.locator('[data-demo="field"]').evaluate(el=>({ink:getComputedStyle(el.querySelector("h2")).color,paint:getComputedStyle(el).backgroundColor}))
    :slug==="three-keycaps"
    ?await page.getByRole("group",{name:/Keycaps/}).evaluate(el=>{const stage=el.closest('[class~="bg-black"]');return{ink:getComputedStyle(stage.querySelector('p[aria-hidden="true"]')).color,paint:getComputedStyle(stage).backgroundColor};})
    :slug==="three-contour-terrain"
    ?await page.locator('div[data-seed]').evaluate(el=>({ink:getComputedStyle(el.querySelector('p[class*="text-white/70"]')).color,paint:getComputedStyle(el).backgroundColor}))
    :slug==="hero-prism"
    ?await page.locator('h1').evaluate(el=>({ink:getComputedStyle(el).color,paint:getComputedStyle(el.closest('[class~="bg-black"]')).backgroundColor}))
    :slug==="footer-ascii-wordmark"
    ?await page.locator('[data-demo="wordmark"]').evaluate(el=>{const stage=el.closest('[class~="bg-black"]');return{ink:getComputedStyle(stage).color,paint:getComputedStyle(stage).backgroundColor};})
    :slug==="footer-columns-status"
    ?await page.locator('footer').first().evaluate(el=>({ink:getComputedStyle(el).color,paint:getComputedStyle(el).backgroundColor}))
    :slug==="effect-border-tracer"
    ?await page.locator('#ebt-job-title').evaluate(el=>({ink:getComputedStyle(el).color,paint:getComputedStyle(el.closest('[class~="bg-[#09090b]"]')).backgroundColor}))
    :slug==="three-ascii-object"
    ?await page.locator('[data-edges]').evaluate(el=>({ink:getComputedStyle(el).color,paint:getComputedStyle(el).backgroundColor}))
    :await page.locator('section[class~="bg-black"]').first().evaluate(el=>({ink:getComputedStyle(el.querySelector('p[class*="text-white"],dd[class*="text-white"]')).color,paint:getComputedStyle(el).backgroundColor}));
   // These authored stages contain fixed dark artwork. A themed DOM
   // background behind the canvas is not the paint the viewer actually sees.
   if(slug.startsWith("three-")||slug==="hero-prism"||slug==="footer-ascii-wordmark")assert.equal(colors.paint,"rgb(0, 0, 0)",slug+" "+theme+" authored paint contrast (fixed artwork)");
   const ratio=contrast(colors.ink,colors.paint);assert(ratio>=7,slug+" "+theme+" authored paint contrast");
   if(slug==="three-globe-arcs"){
    const nested=await page.evaluate(()=>{
     const stage=document.createElement("section");stage.dataset.dfaStyle="crayon";stage.className="bg-black";
     const inner=document.createElement("div");inner.dataset.dfaStyle="crayon";inner.textContent="Nested standalone root";stage.append(inner);document.body.append(stage);
     const sample=()=>({ink:getComputedStyle(inner).color,paint:getComputedStyle(inner).backgroundColor,pencil:getComputedStyle(inner).getPropertyValue("--dfa-ink-pencil").trim()});
     const inherited=sample();inner.dataset.dfaTheme="light";const explicit=sample();stage.remove();return{inherited,explicit};
    });
    assert.equal(nested.inherited.paint,"rgb(0, 0, 0)");assert(contrast(nested.inherited.ink,nested.inherited.paint)>=7);
    assert.equal(nested.explicit.paint,"rgb(250, 250, 250)");assert(contrast(nested.explicit.ink,nested.explicit.paint)>=7);
   }
   const selections=[];
   if(slug==="three-holo-card")for(const name of ["front","back"]){
    const radio=page.getByRole("radio",{name,exact:true});await radio.click();
    await radio.evaluate(async el=>{getComputedStyle(el).color;await Promise.all(el.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});
    const selected=await radio.evaluate(el=>({ink:getComputedStyle(el).color,paint:getComputedStyle(el.querySelector(':scope > [style*="background"]')).backgroundColor,checked:el.getAttribute("aria-checked")}));
    assert.equal(selected.checked,"true");assert(contrast(selected.ink,selected.paint)>=7,slug+" "+theme+" authored paint contrast (selected pill)");selections.push({name,...selected});
   }
   if(slug==="three-ascii-object"){
    const radios=page.locator('[role="radio"][aria-checked="true"]');assert(await radios.count()>0);
    for(const radio of await radios.all()){
     await radio.evaluate(async el=>{getComputedStyle(el).color;await Promise.all(el.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});
     const selected=await radio.evaluate(el=>({name:el.textContent,ink:getComputedStyle(el).color,paint:getComputedStyle(el.querySelector(':scope > [style*="background"]')).backgroundColor}));
     assert(contrast(selected.ink,selected.paint)>=7,slug+" "+theme+" authored paint contrast (selected pill)");selections.push(selected);
    }
   }
   await page.screenshot({path:out+"/"+slug+"-"+theme+".png"});assert.deepEqual(errors,[]);report.push({slug,theme,colors,contrast:ratio,...(selections.length?{selections}:{})});await page.close();
  }
  await context.close();
 }
 fs.writeFileSync(out+"/report.json",JSON.stringify(report,null,2));
 console.log("Authored button labels and dark shader overlays retain their contrast in both themes.");
}finally{await browser.close();}
