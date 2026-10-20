import fs from 'node:fs';
export async function check({page,mount,assert,capture=async()=>{}}) {
 await page.setViewportSize({width:1440,height:1200});
 await mount(`import {flushSync} from 'react-dom';window.retireReceipts=async()=>{for(const [id,label]of [['access','Verify workspace and tool access'],['team','Meet the account team']]){const ready=new Promise((resolve,reject)=>{let timer;const observer=new MutationObserver(()=>{if([...document.querySelectorAll('[role="status"]')].some(node=>node.textContent.includes(label))){observer.disconnect();clearTimeout(timer);resolve();}});observer.observe(document.getElementById('root'),{subtree:true,childList:true,characterData:true});timer=setTimeout(()=>{observer.disconnect();reject(Error('Receipt did not arrive for '+id))},2000);});flushSync(()=>document.querySelector('[data-demo="tick-'+id+'"]').click());await ready;if(id==='access')await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}return [...document.querySelectorAll('[role="status"]')].map(node=>({text:node.textContent,hidden:node.getAttribute('aria-hidden'),inert:node.hasAttribute('inert')}));};createRoot(document.getElementById('root')).render(<Subject.EmployeeOnboarding onComplete={()=>{}} onReopen={payload=>{window.reopenedReceipt=payload}}/>);`);
 const receipts=await page.evaluate(()=>window.retireReceipts());
 if(process.env.DFA_DRAFT_QA_OUT)fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/receipt-retirement.json',JSON.stringify(receipts,null,2)+'\n');
 assert.equal(receipts.length,2,'The outgoing receipt is still mounted for its exit');
 assert.deepEqual(receipts.map(receipt=>({hidden:receipt.hidden,inert:receipt.inert})),[{hidden:'true',inert:true},{hidden:null,inert:false}],'The outgoing receipt retires immediately');
 assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).count(),1);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>window.reopenedReceipt),{hireId:'noor',taskId:'team'});
 await capture('retired-receipt-live-undo',{audit:true});
}
