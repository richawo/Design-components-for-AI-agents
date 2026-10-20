import fs from 'node:fs';
import sharp from 'sharp';

async function checkContrast({page,mount,assert,capture=async()=>{}}){
 await page.setViewportSize({width:1440,height:1050});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.HeroBlurStatement eyebrow="A sample workflow" status="Invoicing for independent teams" lead="A calmer way to" nouns={[{word:'invoice',note:'From a clear scope to a considered invoice.'},{word:'collect',note:'Keep the next action visible.'},{word:'plan',note:'A shared workspace for the work ahead.'}]} tail={'from the first draft\\nto the last payment.'} grain={0}/>);`);
 const targets=[['tail',page.locator('h1').getByText('from',{exact:true}),3],['eyebrow',page.getByText('A sample workflow',{exact:true}),4.5],['status',page.getByText('Invoicing for independent teams',{exact:true}),4.5],['note',page.getByText('From a clear scope to a considered invoice.',{exact:true}),4.5],['counter',page.locator('[data-demo="rotation-glyph"]').locator('..').locator('span').filter({hasText:/^\s*\/\s*03\s*$/}),4.5]];
 const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0),records=[];
 for(const[name,target,minimum]of targets){
  assert.equal(await target.count(),1,name+' target');
  const data=await target.evaluate(node=>{const style=getComputedStyle(node),canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle=style.color;ctx.fillRect(0,0,1,1);let opacity=1;for(let p=node;p;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);return {color:style.color,rgba:[...ctx.getImageData(0,0,1,1).data],opacity,fontSize:Number.parseFloat(style.fontSize),box:node.getBoundingClientRect().toJSON(),oldVisibility:node.style.visibility}});
  assert.ok(data.opacity>.999,name+' is settled');if(minimum===3)assert.ok(data.fontSize>=24);
  await target.evaluate(node=>node.style.visibility='hidden');const screenshot=await page.screenshot();assert.equal(await target.evaluate(node=>getComputedStyle(node).visibility),'hidden');await target.evaluate((node,value)=>node.style.visibility=value,data.oldVisibility);
  const x=Math.round(data.box.x+data.box.width/2),y=Math.round(data.box.y+data.box.height/2);const bg=[...await sharp(screenshot).extract({left:x,top:y,width:1,height:1}).removeAlpha().raw().toBuffer()];const alpha=data.rgba[3]/255*data.opacity,paint=data.rgba.slice(0,3).map((v,i)=>v*alpha+bg[i]*(1-alpha)),light=[luminance(paint),luminance(bg)].sort((a,b)=>b-a);records.push({name,minimum,ratio:(light[0]+.05)/(light[1]+.05),...data,paintedBackground:bg,compositedForeground:paint});
 }
 const theme=await page.locator('section[aria-label="Introduction"]').evaluate(node=>getComputedStyle(node).getPropertyValue('--bs-page').trim()==='#000000'?'dark':'light');if (process.env.DFA_DRAFT_QA_OUT) fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/painted-contrast-'+theme+'.json',JSON.stringify(records,null,2)+'\n');await capture('painted-text',{viewport:true});assert.deepEqual(records.filter(r=>r.ratio<r.minimum),[],'All useful Hero text retains its actual painted AA contrast');
}

async function checkActions({page,mount,assert,capture=async()=>{}}){
 const outcomes=[];
 for(const width of [320,390]){
  await page.setViewportSize({width,height:1050});await mount(`createRoot(document.getElementById('root')).render(<Subject.HeroBlurStatement lead="A calmer way to" primary={{label:'Start a workspace',href:'#request'}} secondary={{label:'Explore the workflow',href:'#workflow'}} grain={0}/>);`);
  const data=await page.getByRole('region',{name:'Introduction',exact:true}).evaluate(root=>{const r=root.getBoundingClientRect();return {root:r.toJSON(),links:[...root.querySelectorAll('a[href]')].map(link=>{const b=link.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(link);return {label:link.textContent.trim(),box:b.toJSON(),content:range.getBoundingClientRect().toJSON(),rightEdgeHits:link.contains(document.elementFromPoint(Math.min(innerWidth-1,b.right-3),b.y+b.height/2))}})}});
  outcomes.push({width,pass:data.links.every(link=>link.box.x>=data.root.x&&link.box.right<=data.root.right+1&&link.content.right<=data.root.right+1&&link.rightEdgeHits),data});await capture('phone-'+width+'-complete-actions',{viewport:true,audit:process.env.DFA_ORIGINAL_PROOF!=='1'});
 }
 if(process.env.DFA_DRAFT_QA_OUT)if (process.env.DFA_DRAFT_QA_OUT) fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/phone-actions.json',JSON.stringify(outcomes,null,2)+'\n');assert.deepEqual(outcomes.filter(o=>!o.pass),[],'The complete action text and target remain inside the hero');
}

async function checkComplete(context){
 const {page,mount,assert,capture=async()=>{}}=context;
 await checkContrast(context);await checkActions(context);
 await page.setViewportSize({width:1440,height:1050});await mount(`createRoot(document.getElementById('root')).render(<Subject.HeroBlurStatement nouns={[{word:'invoice',note:'First workflow'},{word:'collect',note:'Second workflow'},{word:'plan',note:'Third workflow'}]} grain={0}/>);`);
 const name=()=>page.locator('[data-demo="name"]').innerText();await page.getByRole('button',{name:'Show the next word',exact:true}).press('Enter');await page.waitForFunction(()=>document.querySelector('[data-demo="name"]').innerText.trim()==='collect');assert.equal((await name()).trim(),'collect');await capture('keyboard-next-word',{viewport:true,audit:true});await page.getByRole('button',{name:'Show the next word',exact:true}).press('Space');await page.waitForFunction(()=>document.querySelector('[data-demo="name"]').innerText.trim()==='plan');await capture('keyboard-third-word',{viewport:true,audit:true});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.HeroBlurStatement nouns={[]} grain={0}/>);`);assert.ok((await name()).trim().length>0);assert.doesNotMatch(await page.locator('section').innerText(),/undefined|NaN/);await capture('empty-word-list-fallback',{viewport:true,audit:true});
 await page.emulateMedia({reducedMotion:'no-preference'});await mount(`createRoot(document.getElementById('root')).render(<Subject.HeroBlurStatement interval={90000} grain={0}/>);`);const pause=page.getByRole('button',{name:'Pause word rotation',exact:true});await pause.press('Enter');assert.equal(await page.getByRole('button',{name:'Resume word rotation',exact:true}).getAttribute('aria-pressed'),'true');await capture('keyboard-paused-rotation',{viewport:true,audit:true});await page.getByRole('button',{name:'Resume word rotation',exact:true}).press('Space');assert.equal(await page.getByRole('button',{name:'Pause word rotation',exact:true}).getAttribute('aria-pressed'),'false');await capture('keyboard-resumed-rotation',{viewport:true,audit:true});await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Show the next word',exact:true}).waitFor();await capture('live-reduced-motion',{viewport:true,audit:true});
}

async function checkEntry({page,mount,assert,capture=async()=>{}}){
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:1050});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.HeroBlurStatement interval={90000} grain={0}/>);`,{settle:0});
 await page.waitForTimeout(80);
 const read=()=>page.locator('h1 span[class*="will-change"]').evaluateAll(nodes=>nodes.map(node=>{const style=getComputedStyle(node),matrix=new DOMMatrix(style.transform);return {text:node.textContent,opacity:Number(style.opacity),x:matrix.m41,y:matrix.m42,filter:style.filter};}));
 const before=await read();
 assert.ok(before.some(word=>Math.abs(word.y)>0.1||word.filter!=='none'&&word.filter!=='blur(0px)'),'The control samples an actual in-flight entrance');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const immediate=await read();
 await page.waitForTimeout(250);
 const settled=await read();
 if (process.env.DFA_DRAFT_QA_OUT) fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/mid-entry.json',JSON.stringify({before,immediate,settled,media:await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)},null,2)+'\n');
 await capture('reduced-mid-entry',{viewport:true});
 assert.ok(immediate.every(word=>Math.abs(word.x)<0.1&&Math.abs(word.y)<0.1&&(word.filter==='none'||word.filter==='blur(0px)')),'A live reduction clears in-flight transforms and blur within two frames');
 assert.ok(settled.every(word=>word.opacity===1&&Math.abs(word.y)<0.1&&(word.filter==='none'||word.filter==='blur(0px)')),'The reduced entrance leaves every word readable');
}

async function checkSwap({page,mount,assert,capture=async()=>{}}){
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1050});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.HeroBlurStatement interval={90000} nouns={[{word:'invoice',note:'Prepare an invoice'},{word:'collect',note:'Review a payment'},{word:'plan',note:'Plan the next project'}]} grain={0}/>);`);
 const control=page.locator('[data-demo="rotation"]');await control.press('Enter');await control.press('Space');await page.waitForTimeout(65);
 const read=()=>page.locator('[data-demo="name"] > span[class*="absolute"], [data-demo="rotation"] span.truncate').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length&&getComputedStyle(node).display!=='none').map(node=>{const s=getComputedStyle(node),matrix=new DOMMatrix(s.transform);return {text:node.textContent,opacity:Number(s.opacity),y:matrix.m42,filter:s.filter};}));
 const before=await read();assert.ok(before.some(node=>node.opacity>.01&&(Math.abs(node.y)>.1||node.filter!=='none'&&node.filter!=='blur(0px)')),'The control samples an actual name/note swap');
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const immediate=await read();await page.waitForTimeout(250);const settled=await read();
 if (process.env.DFA_DRAFT_QA_OUT) fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/mid-swap.json',JSON.stringify({before,immediate,settled},null,2)+'\n');await capture('reduced-mid-swap',{viewport:true});
 assert.ok(immediate.filter(node=>node.opacity>.01).every(node=>Math.abs(node.y)<.1&&(node.filter==='none'||node.filter==='blur(0px)')),'A live reduction clears an active name/note swap within two frames');
 assert.deepEqual(settled.map(node=>node.text).sort(),['Review a payment','collect'].sort(),'Only the current word and note remain after the reduced fade');assert.ok(settled.every(node=>node.opacity===1),'The reduced swap finishes its short fade');assert.equal(await control.evaluate(node=>node===document.activeElement),true,'The preference update retains the focused control');
}

export async function check(context) {
 await checkComplete(context);
 await checkEntry(context);
 await checkSwap(context);
}
