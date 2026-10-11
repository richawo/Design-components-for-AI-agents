export async function check({page,mount,assert}){
 await mount(`window.completed=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.CloseChecklist onComplete={async p=>{window.completed.push(p);if(window.fail)throw Error('offline')}}/>);`);
 await page.getByRole('button',{name:/Review expense accruals/}).click();
 await page.getByLabel('Completion evidence',{exact:true}).fill('Workpaper ACC-04 reviewed.');
 assert.equal(await page.getByRole('button',{name:'Complete with evidence',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:/Reconcile bank accounts/}).click();
 await page.getByLabel('Completion evidence',{exact:true}).fill('short');assert.equal(await page.getByRole('button',{name:'Complete with evidence',exact:true}).isDisabled(),true);
 await page.getByLabel('Completion evidence',{exact:true}).fill('Bank statement reconciled.');
 await page.getByRole('button',{name:'Complete with evidence',exact:true}).click();await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 assert.equal(await page.getByLabel('Completion evidence',{exact:true}).inputValue(),'Bank statement reconciled.');
 await page.evaluate(()=>window.fail=false);await page.getByRole('button',{name:'Complete with evidence',exact:true}).click();await page.getByRole('status').filter({hasText:'Task completed'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.completed[1]),{taskId:'bank',evidence:'Bank statement reconciled.'});assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'40');
 await page.getByRole('button',{name:/Review expense accruals/}).click();assert.equal(await page.getByLabel('Completion evidence',{exact:true}).inputValue(),'Workpaper ACC-04 reviewed.');assert.equal(await page.getByRole('button',{name:'Complete with evidence',exact:true}).isDisabled(),false);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CloseChecklist tasks={[{id:'a',title:'Cyclic',stage:'Review',owner:'A',due:'Now',dependsOn:['b'],complete:false},{id:'b',title:'Other',stage:'Review',owner:'B',due:'Now',dependsOn:['a'],complete:false}]} onComplete={()=>{}}/>);`);
 assert.match(await page.locator('section').innerText(),/circular prerequisite/);assert.equal(await page.getByRole('button',{name:'Complete with evidence',exact:true}).isDisabled(),true);
}
