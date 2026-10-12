export async function check({page,mount,assert,choose}){
 await mount(`window.plans=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.BackorderAllocation onAllocate={async p=>{window.plans.push(p);if(window.fail)throw Error('offline')}}/>);`);
 assert.equal(await page.getByRole('button',{name:'Review allocations',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Replace with autofill',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Allocate ORD-2040',exact:true}).inputValue(),'40');
 assert.equal(await page.getByRole('textbox',{name:'Allocate ORD-2046',exact:true}).inputValue(),'40');
 await page.getByRole('textbox',{name:'Allocate ORD-2052',exact:true}).fill('1');
 assert.match(await page.getByRole('alert').innerText(),/exceeds incoming/);
 assert.equal(await page.getByRole('button',{name:'Review allocations',exact:true}).isDisabled(),true);
 await choose(page.getByRole('combobox',{name:'Autofill order',exact:true}), 'risk');
 await page.getByRole('button',{name:'Replace with autofill',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Allocate ORD-2052',exact:true}).inputValue(),'20');
 assert.equal(await page.getByRole('textbox',{name:'Allocate ORD-2046',exact:true}).inputValue(),'20');
 await page.getByRole('button',{name:'Review allocations',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Allocate ORD-2040',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Confirm allocation plan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Confirm allocation plan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'plan saved'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.plans[1]),{sku:'MR-218-INK-M',incomingUnits:80,allocations:[{orderId:'ORD-2040',units:40},{orderId:'ORD-2046',units:20},{orderId:'ORD-2052',units:20}]});
 await page.getByRole('button',{name:'Edit allocations',exact:true}).click();
 await page.getByRole('textbox',{name:'Allocate ORD-2040',exact:true}).fill('41');
 assert.equal(await page.getByRole('textbox',{name:'Allocate ORD-2040',exact:true}).getAttribute('aria-invalid'),'true');
 await mount(`createRoot(document.getElementById('root')).render(<Subject.BackorderAllocation incomingUnits={-1}/>);`);
 assert.match(await page.getByRole('alert').innerText(),/Incoming stock must/);
}
