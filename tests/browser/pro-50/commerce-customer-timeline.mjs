export async function check({page,mount,assert}){
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CustomerTimeline/>);`);
 assert.match(await page.locator('dl').innerText(),/£80.00/);
 await page.getByRole('button',{name:'order · ORD-2048',exact:false}).click();
 assert.match(await page.getByRole('article',{name:'Event details'}).innerText(),/Merino crew/);
 await page.getByRole('button',{name:'Refund',exact:true}).click();
 assert.match(await page.getByRole('article',{name:'Event details'}).innerText(),/-£28.00/);
 await page.getByRole('button',{name:'Sam Ellis',exact:false}).click();
 assert.match(await page.locator('dl').innerText(),/£56.00/);
 assert.equal(await page.getByRole('button',{name:'All',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Robin Park',exact:false}).click();
 assert.match(await page.locator('section').innerText(),/No events in this view/);
 await page.getByRole('textbox',{name:'Find a customer',exact:true}).fill('unknown');
 assert.match(await page.locator('section').innerText(),/No matching customers/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CustomerTimeline customers={[{id:'x',name:'Test',email:'test@example.com',joined:'2026-01-01',events:[{id:'e',kind:'order',occurredAt:'not-a-date',headline:'Invalid',reference:'BAD',description:'Imported',amountMinor:Infinity}]}]}/>);`);
 assert.match(await page.getByRole('status').innerText(),/Invalid event amounts/);
 assert.match(await page.getByRole('article').innerText(),/Date unavailable/);
 assert.doesNotMatch(await page.locator('dl').innerText(),/NaN|Infinity/);
}
