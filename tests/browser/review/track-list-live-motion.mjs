export async function check(context) {
 const reduced = await context.page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const viewport = context.page.viewportSize();
 try { await checkLive(context); }
 finally { await context.page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});if(viewport)await context.page.setViewportSize(viewport); }
}
async function checkLive({page,mount,assert,capture=async()=>{}}) {
 await page.setViewportSize({width:1100,height:1000});await page.emulateMedia({reducedMotion:'no-preference'});
 await mount(`const tracks=[{id:'a',title:'First study',artist:'Meadow',album:'Notes',seconds:180},{id:'b',title:'Second study',artist:'Meadow',album:'Elsewhere',seconds:180},{id:'c',title:'Third study',artist:'Meadow',album:'Notes',seconds:180},{id:'d',title:'Fourth study',artist:'Meadow',album:'Elsewhere',seconds:180}];function Host(){const [shown,setShown]=React.useState(tracks);window.filterTracks=()=>setShown([tracks[0],tracks[2]]);return <Subject.TrackList tracks={shown} onSelect={()=>{}} onQueue={()=>{}}/>}createRoot(document.getElementById('root')).render(<Host/>);`,{settle:0});
 await page.waitForFunction(()=>!!document.querySelector('ol > li')&&Number(getComputedStyle(document.querySelector('ol > li')).opacity)>0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.filterTracks());
 await page.waitForFunction(()=>document.querySelectorAll('ol > li').length===2,{},{timeout:1500});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const rows=await page.locator('ol > li').evaluateAll(nodes=>nodes.map(node=>({top:node.getBoundingClientRect().top,bottom:node.getBoundingClientRect().bottom,opacity:getComputedStyle(node).opacity,filter:getComputedStyle(node).filter,transform:getComputedStyle(node).transform})));
 assert.ok(Math.abs(rows[1].top-rows[0].bottom)<1,'Filtered rows are contiguous');for(const row of rows){assert.equal(row.opacity,'1');assert.ok(['none','blur(0px)'].includes(row.filter));assert.ok(row.transform==='none'||row.transform==='matrix(1, 0, 0, 1, 0, 0)');}
 await capture('live-reduced-filter',{audit:true});
 await mount(`window.trackOrders=[];function Host(){const [tracks,setTracks]=React.useState([{id:'a',title:'First study',artist:'Meadow',album:'Notes',seconds:180},{id:'b',title:'Second study',artist:'Meadow',album:'Notes',seconds:180}]);return <Subject.TrackList tracks={tracks} onReorder={ids=>{window.trackOrders.push([...ids]);setTracks(rows=>ids.map(id=>rows.find(row=>row.id===id)))}}/>}createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.getByRole('button',{name:'Reorder First study, 1 of 2',exact:true}).press('ArrowDown');assert.deepEqual(await page.evaluate(()=>window.trackOrders),[['b','a']]);await page.getByRole('button',{name:'Reorder First study, 2 of 2',exact:true}).waitFor();await capture('reduced-keyboard-order',{audit:true});
 await page.emulateMedia({reducedMotion:'no-preference'});const handle=page.getByRole('button',{name:'Reorder First study, 2 of 2',exact:true});const from=await handle.boundingBox(),to=await page.getByRole('button',{name:'Reorder Second study, 1 of 2',exact:true}).boundingBox();await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2-12,{steps:24});await page.mouse.up();await page.waitForFunction(()=>window.trackOrders.length===2);assert.deepEqual(await page.evaluate(()=>window.trackOrders.at(-1)),['a','b']);await capture('pointer-order-after-preference-change',{audit:true});
}
