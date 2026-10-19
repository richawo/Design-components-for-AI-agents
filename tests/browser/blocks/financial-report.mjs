import { check as checkExports } from '../review/financial-report-exports.mjs';
export async function check({page,mount,assert}){
 await mount(`createRoot(document.getElementById('root')).render(<Subject.FinancialReport/>);`);
 const choose=async label=>{await page.getByRole('combobox').click();await page.getByRole('option',{name:label,exact:true}).click();};
 await choose('September 2026');await page.getByRole('heading',{name:/Cost detail/}).waitFor();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();assert.equal((await downloadPromise).suggestedFilename(),'report-sep.csv');
 await page.emulateMedia({media:'print'});assert.equal(await page.getByRole('heading',{level:1}).innerText(),'Northstar / September 2026');assert.ok(await page.getByRole('table').isVisible());await page.emulateMedia({media:'screen'});
 await mount(`window.calls=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.FinancialReport onExport={async period=>{window.calls.push(period);if(!window.attempt++)throw Error('fixture');}}/>);`);
 await choose('September 2026');await page.getByRole('button',{name:'Export CSV',exact:true}).click();await page.getByRole('status').filter({hasText:'export failed'}).waitFor();await page.getByRole('button',{name:'Export CSV',exact:true}).click();await page.getByRole('status').filter({hasText:'September 2026 exported.'}).waitFor();assert.equal(await page.evaluate(()=>window.calls.at(-1).id),'sep');
 await mount(`createRoot(document.getElementById('root')).render(<Subject.FinancialReport periods={[]}/>);`);assert.ok(await page.getByText('No report periods supplied.').isVisible());assert.ok(await page.getByRole('button',{name:'Export CSV',exact:true}).isDisabled());
 await mount(`createRoot(document.getElementById('root')).render(<Subject.FinancialReport periods={[{id:'bad',label:'Invalid data',revenueMinor:NaN,revenueBudgetMinor:100,lines:[],commentary:[]}]}/>);`);assert.ok(await page.getByRole('alert').isVisible());assert.ok(await page.getByRole('button',{name:'Print report',exact:true}).isDisabled());
 await checkExports({page,mount,assert});
}
