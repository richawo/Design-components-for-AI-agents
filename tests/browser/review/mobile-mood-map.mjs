export async function check({ page, mount, assert }) {
  const feelings = [{ id: "calm", label: "Calm", description: "Settled and unhurried.", pleasantness: 0.6, energy: -0.6 }, { id: "tense", label: "Tense", description: "A little on edge.", pleasantness: -0.6, energy: 0.6 }];
  const props = `feelings={${JSON.stringify(feelings)}} log={[]} nowMinute={600}`;
  await mount(`window.calls=[];window.picks=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MobileMoodMap ${props} onValueChange={id=>window.picks.push(id)} onSave={async(p,signal)=>{window.calls.push({...p,signal:signal instanceof AbortSignal});if(window.fail)throw Error('Not synced yet.');await new Promise(resolve=>window.finishMood=resolve)}}/>);`);
  const field = await page.getByRole("radiogroup").boundingBox();
  const initial = await page.locator('[data-demo="mood-orb"]').boundingBox();
  assert.ok(field && initial && initial.x >= field.x && initial.y >= field.y
    && initial.x + initial.width <= field.x + field.width
    && initial.y + initial.height <= field.y + field.height, "The unselected orb is fully inside the mood map");
  const calm = page.getByRole("radio", { name: /^Calm,/ });
  await calm.press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-demo="mood-word-calm"]').getAttribute('aria-checked') === 'true');
  const orb = await page.locator('[data-demo="mood-orb"]').boundingBox();
  const tense = await page.getByRole("radio", { name: /^Tense,/ }).boundingBox();
  assert.ok(orb && tense);
  await page.mouse.move(orb.x + orb.width / 2, orb.y + orb.height / 2);
  await page.mouse.down();
  await page.mouse.move(tense.x + tense.width / 2, tense.y + tense.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => window.picks.includes('tense'));
  await calm.press("Space");
  await page.waitForFunction(() => document.querySelector('[data-demo="mood-word-calm"]').getAttribute('aria-checked') === 'true');
  const note = page.getByRole("textbox", { name: "Note about this check-in", exact: true });
  await note.fill("Deep work helped.");
  await page.getByRole("button", { name: "Log calm", exact: true }).press("Enter");
  await page.getByRole("alert").filter({ hasText: "Not synced yet." }).waitFor();
  assert.equal(await note.inputValue(), "Deep work helped.");
  assert.equal(await calm.isChecked(), true);
  await page.evaluate(() => window.fail = false);
  await page.getByRole("button", { name: "Try again", exact: true }).press("Enter");
  assert.equal(await calm.isDisabled(), true);
  await page.evaluate(() => window.finishMood());
  await page.getByRole("button", { name: "Logged at 10:00", exact: true }).waitFor();
  await page.getByRole("img", { name: "10:00, Calm", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => ({ id: window.calls[1].feeling.id, note: window.calls[1].note, minute: window.calls[1].minute, signal: window.calls[1].signal })), { id: "calm", note: "Deep work helped.", minute: 600, signal: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileMoodMap ${props} defaultValue="calm" defaultNote="Too long" maxNoteLength={3}/>);`);
  await page.getByRole("alert").filter({ hasText: "Notes stop at 3 characters." }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Log calm", exact: true }).isDisabled(), true);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileMoodMap feelings={[{id:'bad',label:'Bad',description:'Invalid coordinates',pleasantness:2,energy:NaN}]} log={[]}/>);`);
  await page.getByText("No feelings to choose from", { exact: true }).waitFor();
  assert.equal(await page.getByRole("radio").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Pick a feeling", exact: true }).isDisabled(), true);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
}
