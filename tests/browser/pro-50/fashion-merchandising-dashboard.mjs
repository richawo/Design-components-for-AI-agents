export async function check({page,mount,assert,choose}){
 await mount(`createRoot(document.getElementById('root')).render(<Subject.MerchandisingDashboard/>);`);
 assert.match(await page.locator('dl').innerText(),/£28,200.00/);
 await page.getByRole('button',{name:'The ribbed crew',exact:false}).click();
 assert.match(await page.locator('section').innerText(),/61 \/ 80/);
 await page.getByRole('button',{name:'Knitwear',exact:true}).click();
 assert.match(await page.locator('dl').innerText(),/£15,660.00/);
 assert.match(await page.getByRole('status').innerText(),/2 styles/);
 await choose(page.getByRole('combobox',{name:'Collection',exact:true}), 'resort');
 assert.match(await page.locator('dl').innerText(),/£3,840.00/);
 assert.match(await page.getByRole('status').innerText(),/1 style/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.MerchandisingDashboard collections={[{id:'empty',name:'Empty',season:'2026',styles:[]}]}/>);`);
 assert.match(await page.locator('section').innerText(),/No valid styles/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.MerchandisingDashboard collections={[{id:'bad',name:'Bad',season:'2026',styles:[{id:'x',name:'X',category:'A',revenueMinor:100,sizes:[{size:'M',received:0,sold:1}]}]}]}/>);`);
 assert.match(await page.getByRole('status').innerText(),/invalid revenue or stock/);
 assert.doesNotMatch(await page.locator('section').innerText(),/NaN|Infinity/);
}
