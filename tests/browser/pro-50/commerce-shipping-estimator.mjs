export async function check({page,mount,assert,choose}){
 await mount(`window.quotes=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.ShippingEstimator onSelect={async p=>{window.quotes.push(p);if(window.fail)throw Error('offline')}}/>);`);
 assert.equal(await page.getByRole('radio').count(),2);
 assert.match(await page.locator('section').innerText(),/£4.45/);
 await page.getByRole('textbox',{name:'Order value',exact:true}).fill('75.00');
 assert.match(await page.locator('section').innerText(),/£0.00/);
 await page.getByRole('textbox',{name:'Parcel weight',exact:true}).fill('20.001');
 assert.equal(await page.getByRole('radio').count(),0);
 assert.equal(await page.getByRole('button',{name:'Use this quote',exact:true}).isDisabled(),true);
 await page.getByRole('textbox',{name:'Parcel weight',exact:true}).fill('1.250');
 await choose(page.getByRole('combobox',{name:'Destination',exact:true}), 'eu');
 assert.equal(await page.getByRole('radio').count(),1);
 assert.match(await page.locator('section').innerText(),/£14.95/);
 await page.getByRole('button',{name:'Use this quote',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Use this quote',exact:true}).click();
 await page.getByRole('status').filter({hasText:'quote selected'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.quotes[1]),{serviceId:'europe',destinationId:'eu',weightGrams:1250,orderMinor:7500,costMinor:1495});
 await page.getByRole('textbox',{name:'Parcel weight',exact:true}).fill('1.0001');
 assert.equal(await page.getByRole('button',{name:'Use this quote',exact:true}).isDisabled(),true);
 await page.getByRole('textbox',{name:'Parcel weight',exact:true}).fill('1');
 await choose(page.getByRole('combobox',{name:'Destination',exact:true}), 'us');
 assert.match(await page.locator('section').innerText(),/No service matches/);
}
