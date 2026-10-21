export async function check({ page, mount, assert }) {
  await mount(`window.signalChanges=[];function Host(){const[value,setValue]=React.useState({waveform:'sine',frequency:220,gain:-12});return <Subject.HeroSignalWorkbench value={value} onChange={next=>{window.signalChanges.push({...next});setValue(next)}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const square = page.locator('[data-demo="wave-square"]');
  await square.focus();
  await square.press('Space');
  await page.waitForFunction(() => window.signalChanges.length === 1);
  assert.deepEqual(await page.evaluate(() => window.signalChanges[0]), { waveform: 'square', frequency: 220, gain: -12 });
  const pitch = page.locator('[data-demo="signal-frequency"]');
  await pitch.focus();
  await pitch.press('ArrowRight');
  await page.waitForFunction(() => window.signalChanges.length === 2);
  assert.ok(Math.abs(await page.evaluate(() => window.signalChanges[1].frequency) - 220 * 2 ** (1 / 12)) < 1e-6);
  const gain = page.locator('[data-demo="signal-gain"]');
  await gain.focus();
  await gain.press('ArrowRight');
  await page.waitForFunction(() => window.signalChanges.length === 3);
  assert.equal(await page.evaluate(() => window.signalChanges[2].gain), -11);
  assert.equal(await square.getAttribute('aria-checked'), 'true');
  await mount(`createRoot(document.getElementById('root')).render(<Subject.HeroSignalWorkbench frequency={NaN} gain={Infinity} note=""/>);`);
  assert.doesNotMatch(await page.locator('#root').innerText(), /NaN|Infinity/);
  assert.ok(Number.isFinite(Number(await page.locator('[data-demo="signal-frequency"]').inputValue())));
  assert.ok(Number.isFinite(Number(await page.locator('[data-demo="signal-gain"]').inputValue())));
}
