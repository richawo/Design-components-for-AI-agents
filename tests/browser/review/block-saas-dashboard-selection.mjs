export async function check({page,mount,assert,capture=async()=>{}}){
 await page.setViewportSize({width:1440,height:1000});
 await mount(`const points=Array.from({length:14},(_,i)=>({date:new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10),value:1}));const alpha={key:'alpha',label:'Alpha',format:'number',points},beta={key:'beta',label:'Beta',format:'number',points};function Host(){const[metrics,setMetrics]=React.useState([alpha,beta]);window.retireMetric=()=>setMetrics([alpha]);window.restoreMetric=()=>setMetrics([alpha,beta]);return <Subject.SaasDashboard metrics={metrics} records={[]}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.locator('[data-demo="card-beta"]').click();await page.getByRole('heading',{name:'Beta per day',exact:true}).waitFor();
 await page.evaluate(()=>window.retireMetric());await page.getByRole('heading',{name:'Alpha per day',exact:true}).waitFor();
 await page.evaluate(()=>window.restoreMetric());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await capture('returning-metric-selection',{audit:process.env.DFA_ORIGINAL_PROOF!=='1'});
 assert.equal(await page.getByRole('heading',{name:'Alpha per day',exact:true}).count(),1,'Returning metrics cannot steal the visible fallback selection');
}
