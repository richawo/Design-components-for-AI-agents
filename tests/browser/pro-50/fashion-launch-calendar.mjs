export async function check({page,mount,assert}){
 await mount(`window.schedules=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.LaunchCalendar onSchedule={async p=>{window.schedules.push(p);if(window.fail)throw Error('offline')}}/>);`);
 await page.getByRole('button',{name:/^20 October 2026 ·/}).click();
 await page.getByLabel('Proposed release date',{exact:true}).fill('2026-10-21');
 assert.equal(await page.getByRole('button',{name:'Save release date',exact:true}).isDisabled(),true);
 assert.match(await page.locator('section').innerText(),/Complete all required readiness/);
 await page.getByRole('button',{name:/^14 October 2026 ·/}).click();
 await page.getByLabel('Proposed release date',{exact:true}).fill('');
 assert.equal(await page.getByRole('button',{name:'Save release date',exact:true}).isDisabled(),true);
 await page.getByLabel('Proposed release date',{exact:true}).fill('2026-10-10');
 assert.equal(await page.getByRole('button',{name:'Save release date',exact:true}).isDisabled(),true);
 await page.getByLabel('Proposed release date',{exact:true}).fill('2026-11-02');
 await page.getByRole('button',{name:'Save release date',exact:true}).click();
 await page.getByRole('status').filter({hasText:'request failed'}).waitFor();
 assert.equal(await page.getByLabel('Proposed release date',{exact:true}).inputValue(),'2026-11-02');
 await page.evaluate(()=>window.fail=false);
 await page.getByRole('button',{name:'Save release date',exact:true}).click();
 await page.getByRole('status').filter({hasText:'date saved'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.schedules[1]),{launchId:'quiet',date:'2026-11-02'});
 assert.match(await page.getByRole('heading',{level:3}).first().innerText(),/November 2026/);
 await page.getByRole('button',{name:'Next month',exact:true}).click();
 assert.match(await page.locator('section').innerText(),/No releases in this month/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.LaunchCalendar launches={[{id:'bad',name:'Bad',collection:'A',channel:'Web',date:'2026-02-30',owner:'A',checks:[]}]}/>);`);
 assert.match(await page.getByRole('alert').innerText(),/invalid dates/);
}
