export async function check({page,mount,assert,choose}){
 await mount(`window.calls=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.PurchaseOrder onSubmit={async p=>{window.calls.push(p);if(window.fail)throw Error('offline')}}/>);`);
 assert.match(await page.locator('dl').innerText(),/£384.00/);
 await page.getByRole('textbox',{name:'Quantity 1',exact:true}).fill('0');
 assert.equal(await page.getByRole('button',{name:'Review purchase order'}).isDisabled(),true);
 await page.getByRole('textbox',{name:'Quantity 1',exact:true}).fill('3');
 await page.getByRole('textbox',{name:'Unit cost 1',exact:true}).fill('0.10');
 await page.getByRole('textbox',{name:'Shipping cost'}).fill('0.01');
 assert.match(await page.locator('dl').innerText(),/£288.31/);
 await choose(page.getByRole('combobox',{name:'Product 2',exact:true}), 'tote');
 assert.match(await page.getByRole('alert').innerText(),/only once/);
 assert.equal(await page.getByRole('button',{name:'Review purchase order'}).isDisabled(),true);
 await choose(page.getByRole('combobox',{name:'Product 2',exact:true}), 'crew');
 await page.getByRole('button',{name:'Review purchase order'}).click();
 assert.equal(await page.getByRole('textbox',{name:'Unit cost 1',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Save purchase order',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Save purchase order',exact:true}).click();
 await page.getByRole('status').filter({hasText:'draft saved'}).waitFor();
 const result=await page.evaluate(()=>window.calls[1]);
 assert.equal(result.totalMinor,28831);assert.equal(result.lines[0].unitCostMinor,10);assert.equal(result.lines[0].quantity,3);
 await page.getByRole('button',{name:'Edit draft'}).click();
 await choose(page.getByRole('combobox',{name:'Supplier',exact:true}), 'field');
 assert.match(await page.locator('section').innerText(),/Add a product/);
 await page.getByRole('button',{name:'Add product',exact:true}).click();
 assert.equal(await page.getByRole('combobox',{name:'Product 1',exact:true}).evaluate(el=>el.tagName==='SELECT'?el.value:el.dataset.value),'bowl');
}
