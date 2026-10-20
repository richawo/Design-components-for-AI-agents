export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.setViewportSize({width:1440,height:1600});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
  const usual=await page.getByRole('button',{name:'New colleague: Noor Ali',exact:true}).getByText('Noor Ali',{exact:true}).evaluate(node=>({height:node.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(node).lineHeight)}));
  await capture('ordinary-name-wide',{audit:true});
  assert.ok(usual.height<=usual.lineHeight+.5,'An ordinary colleague name stays on one line in a wide header');

  for (const width of [320, 390]) {
    await page.setViewportSize({width,height:1600});
    for (const mode of ['single','custom','native']) {
      await mount(`const hire={id:'long',name:'AlexandraMontgomery'.repeat(5),role:'Customer experience specialist',team:'People operations',start:'12 October 2026',buddy:'Taylor',tasks:[{id:'prepare',label:'Prepare workspace',phase:'Day one',owner:'IT',required:true,complete:false,instructions:['Check equipment and access.'],requires:[]}]};createRoot(document.getElementById('root')).render(<Subject.EmployeeOnboarding title="Onboarding plan" subtitle={'InternationalPeopleOperations'.repeat(6)} hires={${mode==='single'?'[hire]':"[hire,{...hire,id:'second',name:'Ada Reed'}]"}} selectMode="${mode==='native'?'native':'custom'}"/>);`);
      await capture(`long-${mode}-${width}`,{audit:true});
      const header=page.locator('.eo-root > header');
      const breadcrumb=await header.getByRole('navigation',{name:'Breadcrumb'}).boundingBox();
      const details=await header.locator('p').filter({hasText:/^Starts /}).boundingBox();
      const name=mode==='native'?header.getByRole('combobox',{name:'New colleague',exact:true}):header.getByText('AlexandraMontgomery'.repeat(5),{exact:true});
      const box=await name.boundingBox(),frame=await header.boundingBox();
      assert.ok(box.y>=breadcrumb.y+breadcrumb.height,`${mode} ${width}: colleague name clears the breadcrumb`);
      assert.ok(box.y+box.height<=details.y,`${mode} ${width}: colleague name clears start-date details`);
      assert.ok(box.x>=frame.x&&box.x+box.width<=frame.x+frame.width,`${mode} ${width}: colleague picker stays in the header`);
      assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth+1),true);
      if(mode==='custom') {
        await header.getByRole('button',{name:/^New colleague:/}).click();
        await page.getByRole('listbox',{name:'New colleagues',exact:true}).press('End');
        await page.getByRole('listbox',{name:'New colleagues',exact:true}).press('Enter');
        await header.getByRole('button',{name:'New colleague: Ada Reed',exact:true}).waitFor();
      } else if(mode==='native') {
        await name.selectOption('second');
        assert.equal(await name.inputValue(),'second');
      }
    }
  }
}
