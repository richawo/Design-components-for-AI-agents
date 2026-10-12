export async function check({page,mount,assert}){
 await mount(`window.calls=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.FashionWorkspace onSavePlan={async payload=>{window.calls.push(payload);if(!window.attempt++)throw Error('fixture');}}/>);`);
 await page.getByRole('tab',{name:'Line plan',exact:true}).click();const field=page.getByRole('textbox',{name:'Planned styles',exact:true});await field.fill('1');
 const selector=page.getByRole('combobox').first();await selector.click();const labels=await page.getByRole('option').allTextContents();await page.getByRole('option').last().click();
 await selector.click();await page.getByRole('option',{name:labels[0].trim(),exact:true}).click();assert.equal(await field.inputValue(),'1');
 await page.getByRole('button',{name:'Save line plan',exact:true}).click();await page.getByRole('status').filter({hasText:/could not|failed|again/i}).waitFor();assert.equal(await field.inputValue(),'1');
 await page.getByRole('button',{name:'Save line plan',exact:true}).click();await page.getByRole('status').filter({hasText:/saved/i}).waitFor();const calls=await page.evaluate(()=>window.calls);assert.equal(calls.length,2);assert.equal(calls[1].collectionId,'autumn');assert.equal(calls[1].plan.categories[0].styles,1);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.FashionWorkspace scopes={[]}/>);`);assert.ok(await page.getByText('No collection records supplied.').isVisible());
}
