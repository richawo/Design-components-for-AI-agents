export async function check({page,mount,assert,capture=async()=>{}}) {
 await mount(`window.queueRequests=[];createRoot(document.getElementById('root')).render(<Subject.MusicWorkspace tracks={[{id:'first',title:'First track',artist:'The working group',album:'First collection',seconds:180},{id:'second',title:'Second track',artist:'The working group',album:'Second collection',seconds:210}]} initialQueue={['first']} onQueueChange={ids=>{window.queueRequests.push([...ids]);ids.length=0}}/>);`);
 await page.locator('[data-demo="nav-library"]:visible').click();
 await page.getByRole('button',{name:'Play Second track by The working group',exact:true}).hover();
 await page.getByRole('button',{name:'Add Second track to your queue',exact:true}).click();
 await page.locator('[data-demo="nav-queue"]:visible').click();
 const queue=page.getByRole('tabpanel',{name:'Up next',exact:true});
 assert.equal(await queue.getByText('Second track',{exact:true}).isVisible(),true,'Queue callback mutations do not empty the listening queue');
 assert.equal(await queue.getByText('First track',{exact:true}).isVisible(),true);
 assert.deepEqual(await page.evaluate(()=>window.queueRequests),[['first','second']]);
 await capture('queue-callback-snapshot',{audit:true});
}
