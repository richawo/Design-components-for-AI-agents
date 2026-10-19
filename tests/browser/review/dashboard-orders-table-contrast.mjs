export async function check({page,mount,assert,capture=async()=>{}}){
 await page.setViewportSize({width:1440,height:1500});await mount(`createRoot(document.getElementById('root')).render(React.createElement(Subject.CommerceWorkspace,{theme:'light'}));`);
 await page.getByRole('tab',{name:'Orders',exact:true}).click();await page.getByRole('heading',{name:'Order workspace',exact:true}).waitFor();
 await page.waitForFunction(()=>{
  const table=[...document.querySelectorAll('[role="table"]')].find(node=>!node.closest('[inert]'));
  if(!table)return false;
  for(let node=table;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<.9999)return false;
  return true;
 });
 await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
 const contrast=async()=>page.evaluate(async()=>(await axe.run(document.body,{runOnly:{type:'rule',values:['color-contrast']}})).violations.map(({id,nodes})=>({id,nodes:nodes.map(node=>({target:node.target,summary:node.failureSummary}))})));
 assert.deepEqual(await contrast(),[],'Orders table metadata and headings meet AA contrast in the composed workspace');
 const row=page.getByRole('row').filter({has:page.getByRole('cell')}).first();const before=await row.evaluate(node=>getComputedStyle(node).backgroundColor);await row.hover();await page.waitForTimeout(200);assert.notEqual(await row.evaluate(node=>getComputedStyle(node).backgroundColor),before,'The contrast check hovers an actual order row');assert.deepEqual(await contrast(),[],'Orders table metadata retains AA contrast on the hovered row');await capture('orders-table-hover',{audit:true});
}
