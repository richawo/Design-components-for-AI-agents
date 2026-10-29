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
  for(const slug of ["button-magnetic","bg-grain-gradient"]){
   const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(base+"/preview/"+slug+"?visualStyle=crayon&theme="+theme,{waitUntil:"load"});
   await page.locator('[data-dfa-ink-ready="true"]').first().waitFor();
   const colors=slug==="button-magnetic"
    ?await page.getByRole("button",{name:/Start building/}).evaluate(el=>({ink:getComputedStyle(el).color,paint:getComputedStyle(el).backgroundColor}))
    :await page.locator('[data-demo="field"]').evaluate(el=>({ink:getComputedStyle(el.querySelector("h2")).color,paint:getComputedStyle(el).backgroundColor}));
   const ratio=contrast(colors.ink,colors.paint);assert(ratio>=7,slug+" "+theme+" authored paint contrast");
   await page.screenshot({path:out+"/"+slug+"-"+theme+".png"});assert.deepEqual(errors,[]);report.push({slug,theme,colors,contrast:ratio});await page.close();
  }
  await context.close();
 }
 fs.writeFileSync(out+"/report.json",JSON.stringify(report,null,2));
 console.log("Authored button labels and dark shader overlays retain their contrast in both themes.");
}finally{await browser.close();}
