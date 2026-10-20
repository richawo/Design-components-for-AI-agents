export async function check(context) {
 const viewport = context.page.viewportSize();
 try { await checkSelection(context); }
 finally { if (viewport) await context.page.setViewportSize(viewport); }
}
async function checkSelection({page,mount,assert,capture=async()=>{}}){
 await page.setViewportSize({width:1100,height:1000});
 await mount(`const makeScope=(id,label)=>({id,label,employees:[],milestones:[],hires:[],requests:[],balances:[],coverage:[]});window.peopleScopes=[makeScope('first','First department'),makeScope('second','Second department')];function Host(){const[scopes,setScopes]=React.useState(window.peopleScopes);window.setPeopleScopes=setScopes;return <Subject.PeopleWorkspace scopes={scopes}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const department=()=>page.getByRole('combobox',{name:/^Department /});assert.match(await department().innerText(),/First department/);
 await page.evaluate(()=>window.setPeopleScopes([window.peopleScopes[1]]));await page.getByRole('combobox',{name:'Department Second department',exact:true}).waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>window.setPeopleScopes(window.peopleScopes));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await capture('retired-department-return',{audit:true});
 assert.equal(await page.getByRole('combobox',{name:'Department Second department',exact:true}).count(),1,'A returning department cannot reclaim the retired selection');
}
