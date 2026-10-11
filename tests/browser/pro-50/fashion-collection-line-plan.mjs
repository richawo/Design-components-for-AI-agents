export async function check({page,mount,assert}){
 await mount(`window.plans=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.CollectionLinePlan onSave={async p=>{window.plans.push(p);if(window.fail)throw Error('offline')}}/>);`);
 assert.match(await page.locator('dl').innerText(),/£19,200.00/);
 await page.getByRole('textbox',{name:'Planned styles',exact:true}).fill('100');
 assert.match(await page.getByRole('alert').innerText(),/exceeds its cost budget/);
 assert.equal(await page.getByRole('button',{name:'Save line plan',exact:true}).isDisabled(),true);
 await page.getByRole('textbox',{name:'Planned styles',exact:true}).fill('6');
 await page.getByRole('textbox',{name:'Target retail',exact:true}).fill('1');
 assert.equal(await page.getByRole('button',{name:'Save line plan',exact:true}).isDisabled(),true);
 await page.getByRole('textbox',{name:'Target retail',exact:true}).fill('180.00');
 await page.getByRole('button',{name:'Knitwear',exact:false}).click();
 await page.getByRole('button',{name:'Add one style',exact:true}).click();
 assert.match(await page.locator('dl').innerText(),/£20,160.00/);
 await page.getByRole('button',{name:'Save line plan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Save line plan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'line plan saved'}).waitFor();
 const result=await page.evaluate(()=>window.plans[1]);
 assert.equal(result.costMinor,2016000);assert.equal(result.totalUnits,700);assert.equal(result.categories[1].styles,9);
 await page.getByRole('textbox',{name:'Unit cost',exact:true}).fill('0.001');
 assert.equal(await page.getByRole('button',{name:'Save line plan',exact:true}).isDisabled(),true);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CollectionLinePlan budgetMinor={Infinity}/>);`);
 assert.match(await page.getByRole('alert').innerText(),/valid non-negative cost budget/);
}
