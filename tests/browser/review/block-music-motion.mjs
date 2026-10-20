export async function check({page,mount,assert,capture=async()=>{}}) {
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'no-preference'});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.MusicWorkspace/>);`);
 const album=page.locator('[data-demo="album-0"]'),box=await album.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.waitForFunction(()=>new DOMMatrixReadOnly(getComputedStyle(document.querySelector('[data-demo="album-0"]')).transform).a<.999);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.ok(await album.evaluate(node=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(node).transform).a-1)<.001),'The owned album press settles immediately on a live reduced-motion change');
 await page.mouse.up();await page.getByRole('tab',{name:'Your collection',exact:true}).waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const chrome=await page.locator('header h2').first().evaluate(node=>({opacity:getComputedStyle(node).opacity,filter:getComputedStyle(node).filter}));assert.equal(chrome.opacity,'1');assert.ok(['none','blur(0px)'].includes(chrome.filter));
 await page.waitForFunction(()=>document.querySelectorAll('ol[aria-label="Search results"] > li').length===2,{},{timeout:1500});
 const bounds=await page.locator('ol[aria-label="Search results"] > li').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));assert.ok(Math.abs(bounds[1].top-bounds[0].bottom)<1,'Removed tracks leave no blank row slots');
 await page.waitForTimeout(700);await capture('owned-live-reduced-motion',{audit:true});
}
