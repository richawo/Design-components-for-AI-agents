// Focus and pointer activation, preserved host events and live reduced motion.
export async function check({ page, mount, assert }) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mount(`window.tracerEvents=[];window.tracerClicks=0;function Host(){const[enabled,setEnabled]=React.useState(true);window.enableTracer=setEnabled;return <><Subject.EffectBorderTracer mode="interaction" enabled={enabled} style={{width:260,height:150}} onFocusCapture={()=>window.tracerEvents.push('focus')} onBlurCapture={()=>window.tracerEvents.push('blur')}><button onClick={()=>window.tracerClicks++}>Review traced action</button></Subject.EffectBorderTracer><button>Outside the tracer</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const tracer = page.locator('.ebt-root');
  const action = page.getByRole('button', { name: 'Review traced action', exact: true });
  assert.equal(await tracer.getAttribute('data-tracer-state'), 'resting');
  await action.focus();
  await page.waitForFunction(() => document.querySelector('.ebt-root').dataset.tracerState === 'lapping');
  const phase = await page.locator('.ebt-core').first().evaluate(node => node.style.offsetDistance);
  await page.waitForFunction(before => document.querySelector('.ebt-core').style.offsetDistance !== before, phase);
  await action.press('Space');
  assert.equal(await page.evaluate(() => window.tracerClicks), 1);
  await page.getByRole('button', { name: 'Outside the tracer', exact: true }).focus();
  await page.waitForFunction(() => document.querySelector('.ebt-root').dataset.tracerState === 'resting');
  assert.deepEqual(await page.evaluate(() => window.tracerEvents), ['focus', 'blur']);
  await action.focus();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('.ebt-root').dataset.tracerState === 'static');
  const still = await page.locator('.ebt-core').first().evaluate(node => node.style.offsetDistance);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('.ebt-core').first().evaluate(node => node.style.offsetDistance), still);
  assert.equal(await action.evaluate(node => node === document.activeElement), true);
  await page.evaluate(() => window.enableTracer(false));
  await page.waitForFunction(() => document.querySelector('.ebt-root').dataset.tracerState === 'off');
  await mount(`createRoot(document.getElementById('root')).render(<Subject.EffectBorderTracer radius={NaN} thickness={Infinity} duration={NaN} style={{position:'sticky',height:0}}/>);`);
  assert.equal(await tracer.evaluate(node => getComputedStyle(node).position), 'sticky');
  assert.equal(await page.locator('.ebt-blob').count(), 0);
  assert.doesNotMatch(await tracer.getAttribute('style'), /NaN|Infinity/);
}
