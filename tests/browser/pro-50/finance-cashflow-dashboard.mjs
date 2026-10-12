export async function check({page,mount,assert,choose}){
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CashflowDashboard/>);`);
 assert.match(await page.locator('dl').innerText(),/£52,500.00/);
 await choose(page.getByLabel('Account scope',{exact:true}), 'operating');
 assert.match(await page.locator('dl').innerText(),/£26,300.00/);
 await page.getByRole('button',{name:/Payroll and suppliers/}).click();assert.match(await page.getByRole('complementary',{name:'Selected movement'}).innerText(),/-£14,200.00/);
 await choose(page.getByLabel('Reporting period',{exact:true}), '2026-09');assert.match(await page.locator('dl').innerText(),/£24,800.00/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CashflowDashboard accounts={[{id:'a',name:'Exact',institution:'Bank',reference:'A',openingByPeriod:{P:-1}}]} movements={[]}/>);`);
 assert.match(await page.locator('dl').innerText(),/-£0.01/);assert.match(await page.locator('section').innerText(),/No recorded movements/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CashflowDashboard accounts={[{id:'a',name:'Bad',institution:'Bank',reference:'A',openingByPeriod:{P:NaN}}]} movements={[]}/>);`);
 assert.match(await page.getByRole('alert').innerText(),/excluded/);assert.doesNotMatch(await page.locator('section').innerText(),/NaN|Infinity/);
}
