export async function check({page,mount,assert}){
 await mount(`window.plans=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.PreorderPlanner onSave={async p=>{window.plans.push(p);if(window.fail)throw Error('offline')}}/>);`);
 assert.equal(await page.getByRole('button',{name:'Review production',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Replace with suggested plan',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Produce M',exact:true}).inputValue(),'35');
 assert.equal(await page.getByRole('button',{name:'Review production',exact:true}).isEnabled(),true);
 await page.getByRole('textbox',{name:'Produce M',exact:true}).fill('34');
 assert.match(await page.getByRole('alert').innerText(),/multiple of 5/);
 await page.getByRole('textbox',{name:'Demand buffer',exact:true}).fill('0');
 await page.getByRole('button',{name:'Replace with suggested plan',exact:true}).click();
 assert.match(await page.locator('section').innerText(),/15 more units required/);
 assert.equal(await page.getByRole('button',{name:'Review production',exact:true}).isDisabled(),true);
 await page.getByRole('textbox',{name:'Demand buffer',exact:true}).fill('25');
 await page.getByRole('button',{name:'Replace with suggested plan',exact:true}).click();
 await page.getByRole('button',{name:'Review production',exact:true}).click();
 await page.getByRole('button',{name:'Confirm production plan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Confirm production plan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'factory review'}).waitFor();
 const result=await page.evaluate(()=>window.plans[1]);assert.equal(result.totalUnits,100);assert.equal(result.surplusUnits,27);assert.deepEqual(result.quantities.map(s=>s.units),[10,20,35,25,10]);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.PreorderPlanner packMultiple={0}/>);`);
 assert.match(await page.getByRole('alert').innerText(),/Factory minimum and pack multiple/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.PreorderPlanner sizes={[{id:'x',label:'X',preorders:1000000,onHand:0}]} packMultiple={999999} minimumUnits={1} onSave={()=>{}}/>);`);
 await page.getByRole('textbox',{name:'Demand buffer',exact:true}).fill('100');
 await page.getByRole('button',{name:'Replace with suggested plan',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Produce X',exact:true}).inputValue(),'2999997');
 assert.equal(await page.getByRole('button',{name:'Review production',exact:true}).isEnabled(),true);
}
