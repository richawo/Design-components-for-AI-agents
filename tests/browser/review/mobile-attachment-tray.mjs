export async function check({ page, mount, assert }) {
  const files = [{ id: "a", name: "Floor plan.pdf", kind: "pdf", bytes: 1024 }, { id: "b", name: "Joinery.xlsx", kind: "sheet", bytes: 2048 }];
  await mount(`window.sends=[];window.fail=true;window.retries=[];createRoot(document.getElementById('root')).render(<Subject.MobileAttachmentTray files={${JSON.stringify([...files, { id: "bad", name: "Site walk.m4a", kind: "audio", bytes: 512, status: "failed" }])}} defaultSelected={['a']} defaultNote="Plan for Thursday" onSend={async p=>{window.sends.push(p);if(window.fail)throw Error('offline')}} onRetry={f=>window.retries.push(f.id)}/>);`);
  const second = page.getByRole("button", { name: "Joinery.xlsx, 2 KB", exact: true });
  await second.focus();
  await page.keyboard.press("Space");
  assert.equal(await second.getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Site walk.m4a, upload failed", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.retries), ["bad"]);
  const note = page.getByRole("textbox", { name: "Message to Lena Ortiz", exact: true });
  await page.getByRole("button", { name: "Send 2 files", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Couldn’t send. Your files and note are still here." }).waitFor();
  assert.equal(await note.inputValue(), "Plan for Thursday");
  assert.equal(await second.getAttribute("aria-pressed"), "true");
  await page.evaluate(() => window.fail = false);
  await page.getByRole("button", { name: "Send 2 files", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="Message to Lena Ortiz"]')?.value === "");
  assert.deepEqual(await page.evaluate(() => ({ ids: window.sends[1].files.map(f => f.id), note: window.sends[1].note, bytes: window.sends[1].totalBytes })), { ids: ["a", "b"], note: "Plan for Thursday", bytes: 3072 });

  // Host selections over a limit are explicit and cannot be sent.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileAttachmentTray files={${JSON.stringify(files)}} defaultSelected={['a','b']} defaultNote="" maxFiles={1}/>);`);
  await page.getByRole("alert").filter({ hasText: "Up to 1 file at a time" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Send 2 files", exact: true }).isDisabled(), true);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileAttachmentTray files={${JSON.stringify(files)}} defaultSelected={['a','b']} defaultNote="" maxBytes={2048}/>);`);
  await page.getByRole("alert").filter({ hasText: "Sends are capped at 2 KB" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Send 2 files", exact: true }).isDisabled(), true);
  await mount(`window.added=0;createRoot(document.getElementById('root')).render(<Subject.MobileAttachmentTray files={[]} defaultNote="" onAdd={()=>window.added++}/>);`);
  await page.getByText("Everything’s sent", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Send", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Add files", exact: true }).click();
  assert.equal(await page.evaluate(() => window.added), 1);
}
