export async function check({page,mount,assert}){
 await mount(`window.plans=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.AssortmentPlanner onSave={async p=>{window.plans.push(p);if(window.fail)throw Error('offline')}}/>);`);
 assert.equal(await page.getByRole('button',{name:'Save assortment',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Fill London / Marylebone',exact:true}).click();
 await page.getByRole('button',{name:'Fill Manchester / Northern Quarter',exact:true}).click();
 await page.getByRole('button',{name:'Fill Bristol / Clifton',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'London / Marylebone runs',exact:true}).inputValue(),'9');
 assert.equal(await page.getByRole('textbox',{name:'Manchester / Northern Quarter runs',exact:true}).inputValue(),'7');
 assert.equal(await page.getByRole('textbox',{name:'Bristol / Clifton runs',exact:true}).inputValue(),'4');
 await page.getByRole('textbox',{name:'Bristol / Clifton runs',exact:true}).fill('5');
 assert.match(await page.getByRole('alert').innerText(),/exceeds available stock/);
 await page.getByRole('textbox',{name:'Bristol / Clifton runs',exact:true}).fill('4');
 await page.getByRole('button',{name:'Save assortment',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Save assortment',exact:true}).click();
 await page.getByRole('status').filter({hasText:'plan saved'}).waitFor();
 const result=await page.evaluate(()=>window.plans[1]);assert.equal(result.totalUnits,80);assert.deepEqual(result.allocations[0].unitsBySize,{s:9,m:18,l:9});
 await page.getByRole('textbox',{name:'London / Marylebone runs',exact:true}).fill('10');
 assert.equal(await page.getByRole('button',{name:'Save assortment',exact:true}).isDisabled(),true);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AssortmentPlanner sizeRun={[{id:'s',label:'S',unitsPerRun:0,available:10}]}/>);`);
 assert.match(await page.getByRole('alert').innerText(),/complete size run/);
 assert.doesNotMatch(await page.locator('section').innerText(),/NaN|Infinity/);
}
