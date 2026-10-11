export async function check({page,mount,assert}){
 await mount(`window.guides=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.SizeGuide onSave={async p=>{window.guides.push(p);if(window.fail)throw Error('offline')}}/>);`);
 await page.getByRole('textbox',{name:'Chest width M centimetres',exact:true}).fill('52.1');
 await page.getByRole('button',{name:'Inches',exact:true}).click();
 assert.match(await page.getByRole('row',{name:'Chest width',exact:false}).innerText(),/20.5/);
 await page.getByRole('button',{name:'Centimetres',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Chest width M centimetres',exact:true}).inputValue(),'52.1');
 await page.getByRole('textbox',{name:'Chest width M centimetres',exact:true}).fill('52.11');
 assert.equal(await page.getByRole('button',{name:'Save size guide',exact:true}).isDisabled(),true);
 await page.getByRole('textbox',{name:'Chest width M centimetres',exact:true}).fill('52.1');
 await page.getByRole('button',{name:'Body length',exact:true}).click();
 await page.getByRole('button',{name:'Save size guide',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Save size guide',exact:true}).click();
 await page.getByRole('status').filter({hasText:'millimetre precision'}).waitFor();
 assert.equal(await page.evaluate(()=>window.guides[1].measurements[0].millimetres.m),521);
 assert.equal(await page.evaluate(()=>window.guides[1].measurements[1].millimetres.m),690);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.SizeGuide sizes={[{id:'m',label:'M'}]} measurements={[{id:'x',label:'Width',instruction:'Flat',millimetres:{}}]} onSave={()=>{}}/>);`);
 assert.equal(await page.getByRole('button',{name:'Save size guide',exact:true}).isDisabled(),true);
 assert.match(await page.getByRole('table').innerText(),/Check/);
}
