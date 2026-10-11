export async function check({page,mount,assert}){
 await mount(`window.bundles=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.BundleBuilder onCreate={async p=>{window.bundles.push(p);if(window.fail)throw Error('offline')}}/>);`);
 assert.match(await page.locator('dl').innerText(),/£108.00/);
 assert.equal(await page.getByRole('button',{name:'Add one Wool scarf',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Add one Everyday tote',exact:true}).click();
 assert.match(await page.locator('dl').innerText(),/£132.00/);
 assert.match(await page.locator('dl').innerText(),/18/);
 await page.getByRole('textbox',{name:'Bundle price',exact:true}).fill('132.01');
 assert.equal(await page.getByRole('button',{name:'Save bundle',exact:true}).isDisabled(),true);
 await page.getByRole('textbox',{name:'Bundle price',exact:true}).fill('100.01');
 await page.getByRole('button',{name:'Save bundle',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Save bundle',exact:true}).click();
 await page.getByRole('status').filter({hasText:'definition saved'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.bundles[1]),{name:'The weekend kit',priceMinor:10001,items:[{productId:'crew',quantity:1},{productId:'tote',quantity:2}],capacity:18});
 await page.getByRole('textbox',{name:'Catalogue search',exact:true}).fill('unknown');
 assert.match(await page.locator('section').innerText(),/No products match/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.BundleBuilder products={[{id:'x',name:'Last item',sku:'X',priceMinor:10000,stock:1}]} onCreate={()=>{}}/>);`);
 assert.equal(await page.getByRole('button',{name:'Add one Last item',exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'Save bundle',exact:true}).isDisabled(),true);
}
