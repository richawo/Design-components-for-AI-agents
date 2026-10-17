export async function check({ page, mount, assert }) {
  const root = { id: "root", author: "Mara Vale", time: "10:41", text: "Which version should we ship?", reactions: [{ kind: "check", count: 1 }] };
  await mount(`window.sent=[];window.reactions=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MobileChannelThread root={${JSON.stringify(root)}} replies={[{id:'reply',author:'Sam Patel',time:'10:42',text:'Version B is ready.'}]} defaultDraft="Ship version B" onReact={(...args)=>window.reactions.push(args)} onSend={async p=>{window.sent.push(p);if(window.fail)throw Error('offline')}}/>);`);
  const reaction = page.getByRole("button", { name: "Agree, 1", exact: true });
  await reaction.focus();
  await page.keyboard.press("Space");
  assert.deepEqual(await page.evaluate(() => window.reactions[0]), ["root", "check", true]);
  assert.equal(await page.getByRole("button", { name: "Agree, 2", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Quote Sam Patel", exact: true }).click();
  await page.getByText("Replying to Sam Patel", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await page.getByRole("button", { name: "Not sent. Retry", exact: true }).waitFor();
  assert.match(await page.locator("#root").innerText(), /Ship version B/);
  await page.evaluate(() => window.fail = false);
  await page.getByRole("button", { name: "Not sent. Retry", exact: true }).click();
  await page.getByText("Sent", { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.sent), [{ text: "Ship version B", quoteId: "reply" }, { text: "Ship version B", quoteId: "reply" }]);
  await mount(`window.retried=0;createRoot(document.getElementById('root')).render(<Subject.MobileChannelThread replies={[]} status="error" defaultDraft="Kept reply" onRetry={()=>window.retried++}/>);`);
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "Retry loading the thread", exact: true }).click();
  assert.equal(await page.evaluate(() => window.retried), 1);
  assert.equal(await page.getByRole("textbox", { name: "Reply", exact: true }).inputValue(), "Kept reply");
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileChannelThread replies={[]} status="unavailable" statusMessage="This thread is archived."/>);`);
  await page.getByText("This thread is archived.", { exact: true }).first().waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Reply", exact: true }).count(), 0);
}
