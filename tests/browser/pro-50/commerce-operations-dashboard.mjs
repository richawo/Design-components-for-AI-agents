export async function check({page,mount,assert}){
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard/>);`);
 assert.match(await page.locator('dl').innerText(),/£117,702.00/);
 await page.getByRole('button',{name:'Retail',exact:false}).click();
 assert.match(await page.locator('dl').innerText(),/£49,274.00/);
 assert.match(await page.getByRole('status').innerText(),/1 channel/);
 await page.getByRole('button',{name:'Last month',exact:true}).click();
 assert.match(await page.locator('dl').innerText(),/£289,560.00/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard periods={[{id:'empty',label:'Empty',channels:[]}]}/>);`);
 assert.match(await page.locator('section').innerText(),/No channel data/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard periods={[{id:'bad',label:'Bad',channels:[{id:'x',name:'Invalid',visits:0,checkouts:0,orders:0,revenueMinor:Infinity,dailyRevenueMinor:[],exceptions:[]}]}]}/>);`);
 assert.match(await page.getByRole('status').innerText(),/invalid metrics/);
 assert.doesNotMatch(await page.locator('dl').innerText(),/NaN|Infinity/);
}
