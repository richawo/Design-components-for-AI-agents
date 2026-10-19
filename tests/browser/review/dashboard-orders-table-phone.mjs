export async function check({page,mount,assert,capture=async()=>{}}){
 const previousViewport=page.viewportSize();
 try{
 await page.setViewportSize({width:320,height:940});await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
 await page.getByRole('tab',{name:'Orders',exact:true}).click();const heading=page.getByRole('heading',{name:'Order workspace',exact:true});await heading.waitFor();
 const pill=page.getByRole('cell').getByText('Paid',{exact:true});await pill.waitFor();
 const size=await pill.evaluate(node=>({height:node.getBoundingClientRect().height,line:parseFloat(getComputedStyle(node).lineHeight)}));assert.ok(size.height<=size.line+10,'Order status labels stay on one line in a 320px workspace');
 assert.equal(await heading.evaluate(node=>{const text=node.firstChild,start=text.textContent.indexOf('workspace'),range=document.createRange();range.setStart(text,start);range.setEnd(text,start+'workspace'.length);return [...range.getClientRects()].filter(rect=>rect.width>0).length}),1,'The workspace heading keeps ordinary words intact');
 const customer=page.getByRole('cell').getByText('Casey Jones',{exact:true});assert.equal(await customer.evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'Normal customer names remain readable on the phone');await capture('orders-phone-320',{audit:true});
 }finally{if(previousViewport)await page.setViewportSize(previousViewport)}
}
