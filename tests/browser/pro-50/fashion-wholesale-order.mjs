export async function check({page,mount,assert}){
 await mount(`window.orders=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.WholesaleOrder onSubmit={async p=>{window.orders.push(p);if(window.fail)throw Error('offline')}}/>);`);
 const review=page.getByRole('button',{name:'Review wholesale order',exact:true});
 assert.equal(await review.isDisabled(),true);
 await page.getByRole('button',{name:'Add pack The wool overcoat',exact:true}).click();
 assert.equal(await review.isDisabled(),true);
 await page.getByRole('button',{name:'Add pack The ribbed crew',exact:true}).click();
 assert.equal(await page.getByLabel('The ribbed crew packs',{exact:true}).inputValue(),'2');
 assert.match(await page.locator('section').innerText(),/18 units/);assert.match(await page.locator('section').innerText(),/£888.00/);
 await page.getByLabel('The ribbed crew packs',{exact:true}).fill('1');assert.equal(await review.isDisabled(),true);
 await page.getByLabel('The ribbed crew packs',{exact:true}).fill('2');
 await page.getByLabel('The wool overcoat packs',{exact:true}).fill('9');assert.equal(await review.isDisabled(),true);
 await page.getByLabel('The wool overcoat packs',{exact:true}).fill('1');
 await review.click();await page.getByRole('button',{name:'Submit buying draft',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);await page.getByRole('button',{name:'Submit buying draft',exact:true}).click();
 await page.getByRole('status').filter({hasText:'draft submitted'}).waitFor();
 const result=await page.evaluate(()=>window.orders[1]);assert.equal(result.totalMinor,88800);assert.equal(result.totalUnits,18);assert.deepEqual(result.lines[0].unitsBySize,{S:1,M:2,L:2,XL:1});assert.deepEqual(result.lines[1].unitsBySize,{S:2,M:4,L:4,XL:2});
 assert.equal(await page.getByRole('button',{name:'Submit buying draft',exact:true}).count(),0);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.WholesaleOrder styles={[{id:'bad',name:'Invalid',colour:'None',delivery:'None',unitMinor:-10,minimumPacks:1,pack:[]}]}/>);`);
 assert.match(await page.getByRole('alert').innerText(),/invalid price/);assert.equal(await page.getByRole('button',{name:'Review wholesale order',exact:true}).isDisabled(),true);
}
