// A fixed paper material must keep its ink legible inside either host theme.
import fs from "node:fs";
import assert from "node:assert/strict";
import {launchChromium} from "../../scripts/lib/browser.mjs";

const base=process.env.TEST_BASE||"http://127.0.0.1:4189",license=process.env.TEST_STYLE_LICENSE;
if(!license)throw Error("Set TEST_STYLE_LICENSE to a Pro key scoped to TEST_BASE");
const out=process.env.TEST_OUT||"test-results/crayon-authored-paper";fs.mkdirSync(out,{recursive:true});
const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const browser=await launchChromium({args:[]}),report=[];
try{
 for(const theme of ["light","dark"]){
  const context=await browser.newContext({viewport:{width:1000,height:1100},reducedMotion:"reduce"});
  await context.addCookies([{name:"dfa_license",value:license,url:base,httpOnly:true,sameSite:"Lax",secure:new URL(base).protocol==="https:"}]);
  const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/preview/pricing-receipt?visualStyle=crayon&theme="+theme,{waitUntil:"load"});
  await page.locator('[data-dfa-ink-ready="true"]').first().waitFor();
  for(const name of ["Solo","Team"]){
   await page.getByRole("tab",{name:new RegExp(name)}).click();
   await page.waitForTimeout(100);
   const ink=await page.locator('[class~="bg-(--rc-receipt)"]').first().evaluate(el=>{
    const css=getComputedStyle(el),edge=el.querySelector('[data-dfa-ink="edge"]');
    const selected=document.querySelector('[role="tab"][aria-selected="true"]'),selectedPaper=selected?.querySelector('[class~="bg-(--rc-paper)"]'),selectedEdge=selected?.querySelector('[data-dfa-ink="edge"]');
    return{background:css.backgroundColor,text:css.color,pencil:edge?getComputedStyle(edge).color:null,selectedBackground:selectedPaper?getComputedStyle(selectedPaper).backgroundColor:null,selectedPencil:selectedEdge?getComputedStyle(selectedEdge).color:null,body:el.textContent};
   });
   assert(contrast(ink.background,ink.text)>=7,theme+" "+name+" printed ink must remain readable");
   if(ink.pencil)assert(contrast(ink.background,ink.pencil)>=7,theme+" paper contour contrast");
   if(ink.selectedBackground&&ink.selectedPencil)assert(contrast(ink.selectedBackground,ink.selectedPencil)>=7,theme+" selected ticket contour contrast");
   assert.equal(await page.getByRole("tab",{name:new RegExp(name)}).getAttribute("aria-selected"),"true");
   report.push({theme,selected:name,ink,contrast:contrast(ink.background,ink.text)});
  }
  await page.screenshot({path:out+"/"+theme+".png"});assert.deepEqual(errors,[]);await context.close();
 }
 fs.writeFileSync(out+"/report.json",JSON.stringify(report,null,2));
 console.log("Receipt print, drawn edges and selected tickets keep their contrast in both themes.");
}finally{await browser.close();}
