export async function check({page,mount,assert,choose}){
 await mount(`window.rules=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.PromotionBuilder onSave={async p=>{window.rules.push(p);if(window.fail)throw Error('offline')}}/>);`);
 assert.match(await page.locator('dl').innerText(),/£65.00/);
 await page.getByRole('button',{name:'Returning',exact:true}).click();
 assert.match(await page.locator('dl').innerText(),/£80.00/);
 assert.match(await page.getByRole('status').first().innerText(),/outside the selected audience/);
 await page.getByRole('button',{name:'New customer',exact:true}).click();
 await choose(page.getByRole('combobox',{name:'Eligible category',exact:true}), 'Accessories');
 assert.match(await page.locator('dl').innerText(),/£75.20/);
 await choose(page.getByRole('combobox',{name:'Discount type',exact:true}), 'fixed');
 await page.getByRole('textbox',{name:'Discount value',exact:true}).fill('100.00');
 await page.getByRole('textbox',{name:'Maximum saving',exact:true}).fill('');
 assert.match(await page.locator('dl').innerText(),/£56.00/);
 await page.getByRole('textbox',{name:'Promotion code',exact:true}).fill('!');
 assert.equal(await page.getByRole('button',{name:'Save rule',exact:true}).isDisabled(),true);
 await page.getByRole('textbox',{name:'Promotion code',exact:true}).fill('offer');
 await page.getByRole('button',{name:'Save rule',exact:true}).click();
 await page.getByRole('status').last().filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Save rule',exact:true}).click();
 await page.getByRole('status').last().filter({hasText:'rule saved'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.rules[1]),{code:'OFFER',kind:'fixed',value:10000,minimumMinor:5000,capMinor:null,category:'Accessories',audience:'new'});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.PromotionBuilder basket={[{id:'bad',name:'Bad',category:'X',quantity:-1,priceMinor:100}]}/>);`);
 assert.match(await page.locator('section').innerText(),/Invalid basket lines/);
 assert.doesNotMatch(await page.locator('dl').innerText(),/NaN|Infinity/);
}
