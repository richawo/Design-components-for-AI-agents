export async function check({page,mount,assert}){
 await mount(`window.calls=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.FulfilmentDesk onResolve={async p=>{window.calls.push(p);if(window.fail)throw Error('offline')}}/>);`);
 assert.equal(await page.getByRole('button',{name:'Review action',exact:true}).isDisabled(),true);
 await page.getByRole('radio').first().check();
 await page.getByRole('textbox',{name:'Action note'}).fill('Address verified with the customer.');
 await page.getByRole('button',{name:'Review action',exact:true}).click();
 await page.getByRole('button',{name:'Record recovery',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 assert.match(await page.locator('section').innerText(),/Address verified with the customer\./);
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Record recovery',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Recovery action recorded'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls),[{shipmentId:'s1',actionId:'label',note:'Address verified with the customer.'},{shipmentId:'s1',actionId:'label',note:'Address verified with the customer.'}]);
 await page.getByRole('textbox',{name:'Find a shipment'}).fill('nothing');
 assert.match(await page.locator('section').innerText(),/No shipments match/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.FulfilmentDesk shipments={[{id:'x',customer:'A',order:'1',destination:'UK',promise:'Today',issue:'Check',detail:'Review',items:[],actions:[]}]} />);`);
 assert.match(await page.locator('section').innerText(),/No recovery actions/);
 assert.equal(await page.getByRole('button',{name:'Review action',exact:true}).isDisabled(),true);
}
