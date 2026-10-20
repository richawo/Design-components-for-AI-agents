export async function check({page,mount,assert,capture=async()=>{}}){
 await page.setViewportSize({width:1400,height:940});await mount(`createRoot(document.getElementById('root')).render(<Subject.SaasDashboard/>);`);
 const names=[];for(const name of ['Harbour Works','Northline Studio']){const el=page.getByRole('row').getByText(name,{exact:true});names.push(await el.evaluate(node=>({name:node.textContent,width:node.clientWidth,needed:node.scrollWidth})));}
 await capture('complete-default-workspace-names',{audit:process.env.DFA_ORIGINAL_PROOF!=='1'});
 assert.deepEqual(names.filter(item=>item.needed>item.width+1),[],'Ordinary workspace names fit the available wide directory');
}
