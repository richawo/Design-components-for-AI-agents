import fs from 'node:fs';
export async function checkDirection({page,mount,assert,capture=async()=>{}},component){
 const outcomes=[];
 const cases=[{name:'english-in-rtl',dir:'rtl',language:'en',expected:'ltr',lead:'A calmer way to',word:'invoice',tail:'keep the work clear.',title:'Your Solo workspace.',body:'Use your email to request access.',success:'Your request is received.'},{name:'arabic-in-ltr',dir:'ltr',language:'ar',expected:'rtl',lead:'طريقة أوضح إلى',word:'عملك',tail:'من المسودة إلى الدفعة الأخيرة.',title:'مساحة عمل لفريقك',body:'استخدم بريدك لطلب الوصول.',success:'تم استلام طلبك.'},{name:'mixed-in-rtl',dir:'rtl',language:'en',expected:'ltr',lead:'A calmer way to',word:'استوديو',tail:'keep the work clear.',title:'Your استوديو workspace.',body:'Use your email to request استوديو access.',success:'Your استوديو request is received.'}];
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const c of cases){
  await page.setViewportSize({width:1440,height:1050});
  const props=component==='hero'?{lead:c.lead,nouns:[{word:c.word,note:'A clear next step.'}],tail:c.tail,grain:0}:{title:c.title,body:c.body,successText:c.success,readers:0};
  const render=component==='hero'?'<Subject.HeroBlurStatement {...props}/>':'<Subject.FooterNewsletter {...props} onSubscribe={async email=>{window.directionWrites.push(email)}}/>';
  await mount(`const props=${JSON.stringify(props)};window.directionWrites=[];createRoot(document.getElementById('root')).render(<div dir="${c.dir}" lang="${c.language}">${render}</div>);`);
  const heading=page.getByRole('heading',{level:component==='hero'?1:2});await heading.scrollIntoViewIfNeeded();
  const direction=await heading.evaluate(node=>getComputedStyle(node).direction);outcomes.push({name:c.name+'-heading',expected:c.expected,actual:direction,pass:direction===c.expected});await capture('direction-'+c.name,{viewport:true,audit:process.env.DFA_ORIGINAL_PROOF!=='1'});
  if(component==='footer'){
   const body=page.getByText(c.body,{exact:true}),actual=await body.evaluate(node=>getComputedStyle(node).direction);outcomes.push({name:c.name+'-body',expected:c.expected,actual,pass:actual===c.expected});const input=page.getByRole('textbox',{name:'Email address',exact:true});await input.fill('direction@studio.test');await input.press('Enter');const status=page.getByRole('status');await status.waitFor();const actualStatus=await status.evaluate(node=>getComputedStyle(node).direction);outcomes.push({name:c.name+'-status',expected:c.expected,actual:actualStatus,pass:actualStatus===c.expected});assert.deepEqual(await page.evaluate(()=>window.directionWrites),['direction@studio.test']);await capture('direction-'+c.name+'-received',{viewport:true,audit:process.env.DFA_ORIGINAL_PROOF!=='1'});
  }
 }
 if(process.env.DFA_DRAFT_QA_OUT){fs.mkdirSync(process.env.DFA_DRAFT_QA_OUT,{recursive:true});fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/'+component+'-direction-outcomes.json',JSON.stringify(outcomes,null,2)+'\n')}assert.deepEqual(outcomes.filter(x=>!x.pass),[],'Sentence direction follows its content, including English fallback and mixed names');
}
export const check=context=>checkDirection(context,process.env.DFA_DIRECTION_COMPONENT);
