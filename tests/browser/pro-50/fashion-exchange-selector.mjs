export async function check({page,mount,assert}){
 await mount(`window.requests=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.ExchangeSelector onRequest={async p=>{window.requests.push(p);if(window.fail)throw Error('offline')}}/>);`);
 assert.equal(await page.getByRole('button',{name:'S (original variant)',exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'L (out of stock)',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Ink',exact:true}).click();
 await page.getByRole('button',{name:'M',exact:true}).click();
 assert.match(await page.locator('aside').innerText(),/£8.00/);
 await page.getByRole('textbox',{name:'Exchange quantity',exact:true}).fill('2');
 assert.equal(await page.getByRole('button',{name:'Review exchange',exact:true}).isDisabled(),true);
 await page.getByRole('textbox',{name:'Exchange quantity',exact:true}).fill('1');
 await page.getByRole('button',{name:'Review exchange',exact:true}).click();
 await page.getByRole('button',{name:'Request exchange',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Request exchange',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request recorded'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.requests[1]),{orderId:'ORD-2048',originalVariantId:'oat-s',replacementVariantId:'ink-m',quantity:1,reason:'Size too small',adjustmentMinor:800});
 assert.equal(await page.getByRole('button',{name:'Request exchange',exact:true}).count(),0);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.ExchangeSelector original={{orderId:'A',productName:'Crew',variantId:'old',color:'Ink',size:'S',quantity:2,paidMinor:10000}} onRequest={()=>{}}/>);`);
 await page.getByRole('button',{name:'M',exact:true}).click();
 await page.getByRole('textbox',{name:'Exchange quantity',exact:true}).fill('2');
 assert.match(await page.locator('aside').innerText(),/£16.00/);
 assert.match(await page.locator('aside').innerText(),/Amount to refund/);
 await page.getByRole('button',{name:'Oat',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Review exchange',exact:true}).isDisabled(),true);
}
