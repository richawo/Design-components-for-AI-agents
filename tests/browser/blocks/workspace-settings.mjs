export async function check({page,mount,assert}){
 await mount(`window.calls=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.WorkspaceSettings onSave={async change=>{window.calls.push(change);if(!window.attempt++)throw Error('fixture');}}/>);`);
 const name=page.getByRole('textbox',{name:'Workspace name',exact:true});await name.fill('Atlas Studio');await name.press('Control+s');await page.getByText(/Couldn.t save/).waitFor();assert.equal(await name.inputValue(),'Atlas Studio');await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByText('Changes saved', {exact:true}).waitFor();
 await page.getByRole("tab",{name:"Notifications",exact:true}).click();
 const preference=page.locator('[data-demo="preference-1"]');await preference.focus();await preference.press('Space');await preference.press('Control+s');await page.getByRole('status').filter({hasText:'Preferences saved.'}).waitFor();
 const calls=await page.evaluate(()=>window.calls);assert.equal(calls.length,3);assert.equal(calls[0].section,'profile');assert.equal(calls[1].values.name,'Atlas Studio');assert.deepEqual(calls[2],{section:'notifications',values:['essential']});
 await page.getByRole("tab",{name:"Access policy",exact:true}).click();
 const permission=page.locator('[data-demo="permission-viewer-export"]');await permission.click();await permission.press('Control+s');await page.getByRole('status').filter({hasText:'Access policy saved.'}).waitFor();assert.ok((await page.evaluate(()=>window.calls.at(-1).values.viewer)).includes('export'));
 await mount(`createRoot(document.getElementById('root')).render(<Subject.WorkspaceSettings/>);`);await page.getByRole('textbox',{name:'Workspace name',exact:true}).fill('No persistence');assert.ok(await page.locator('[data-demo="save"]').isDisabled());assert.ok(await page.locator('[data-demo="save-preferences"]').isDisabled());
}
