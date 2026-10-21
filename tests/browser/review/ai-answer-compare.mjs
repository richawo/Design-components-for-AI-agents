export async function check({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'reduce'});
 await mount(`window.voteJobs=[];window.answerRetries=[];const initial=[{id:'first',model:'Model Cedar',paragraphs:[[{text:'Inspect the trace before changing the timeout.',claim:'trace'}]]},{id:'second',model:'Model Birch',paragraphs:[[{text:'Reproduce the failure with the same inputs.',claim:'replay'}]],status:'error',error:'The answer request failed.'}];function Host(){const[answers,setAnswers]=React.useState(initial);return <Subject.AiAnswerCompare answers={answers} sources={[]} reasons={['Clearer reasoning','More useful detail']} onRetry={id=>{window.answerRetries.push(id);setAnswers(old=>old.map(answer=>answer.id===id?{...answer,status:'ready'}:answer))}} onSubmit={verdict=>new Promise((resolve,reject)=>window.voteJobs.push({verdict:JSON.parse(JSON.stringify(verdict)),resolve,reject}))}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const error=page.getByRole('alert').filter({hasText:'The answer request failed.'});await error.waitFor();
 assert.equal(await page.locator('[data-demo="prefer-a"]').isDisabled(),true);
 await error.getByRole('button').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.answerRetries.length===1);assert.deepEqual(await page.evaluate(()=>window.answerRetries),['second']);
 const preference=page.locator('[data-demo="prefer-a"]');await preference.focus();await preference.press('Space');
 assert.equal(await preference.getAttribute('aria-checked'),'true');
 const reason=page.getByRole('button',{name:'Clearer reasoning',exact:true});await reason.focus();await reason.press('Enter');assert.equal(await reason.getAttribute('aria-pressed'),'true');
 const submit=page.locator('[data-demo="submit"]');await submit.focus();await submit.press('Enter');await page.waitForFunction(()=>window.voteJobs.length===1);
 assert.equal(await submit.getAttribute('aria-busy'),'true');await submit.press('Enter');assert.equal(await page.evaluate(()=>window.voteJobs.length),1);
 await page.evaluate(()=>window.voteJobs[0].reject(new Error('The review service is offline.')));
 await page.getByRole('alert').filter({hasText:'The review service is offline.'}).waitFor();
 assert.equal(await preference.getAttribute('aria-checked'),'true');assert.equal(await reason.getAttribute('aria-pressed'),'true');
 await submit.focus();await submit.press('Space');await page.waitForFunction(()=>window.voteJobs.length===2);
 assert.deepEqual(await page.evaluate(()=>window.voteJobs.map(job=>job.verdict)),[{choice:'a',reasons:['Clearer reasoning']},{choice:'a',reasons:['Clearer reasoning']}]);
 await page.evaluate(()=>window.voteJobs[1].resolve());await page.getByText(/Vote recorded\./).first().waitFor();
 assert.equal(await page.getByText('A was Model Cedar, B was Model Birch.',{exact:true}).count(),1);
 await page.getByRole('button',{name:'Change vote',exact:true}).focus();await page.keyboard.press('Enter');await preference.waitFor();assert.equal(await preference.getAttribute('aria-checked'),'true');
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AiAnswerCompare question="Compare two unavailable answers" answers={[{id:'one',model:'First model',paragraphs:[],status:'loading'},{id:'two',model:'Second model',paragraphs:[],status:'loading'}]} sources={[]} reasons={[]}/>);`);
 assert.equal(await page.getByRole('radio',{disabled:true}).count()>=3,true);assert.equal(await page.locator('[data-demo="submit"]').count(),0);
 assert.equal(await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)<=innerWidth),true);
}
