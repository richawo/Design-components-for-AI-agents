// Real strokes, keyboard seals, clear notifications and preserved foreground events.
export async function check({ page, mount, assert }) {
  await mount(`window.inkStrokes=[];window.inkClears=0;window.inkActions=0;createRoot(document.getElementById('root')).render(<Subject.EffectInkTrail height={420} lifetimeMs={0} initialStrokes={[]} onStroke={stroke=>window.inkStrokes.push(structuredClone(stroke))} onClear={()=>window.inkClears++}><button onClick={()=>window.inkActions++}>Open ink detail</button></Subject.EffectInkTrail>);`);
  const stage = page.locator('[data-demo="ink-stage"]');
  assert.equal(await page.locator('[data-demo="ink-clear"]').isDisabled(), true);
  const box = await stage.boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.55, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => window.inkStrokes.length === 1);
  const stroke = await page.evaluate(() => window.inkStrokes[0]);
  assert.equal(stroke.kind, 'brush');
  assert.equal(stroke.lifetimeMs, 0);
  assert.ok(stroke.points.length > 2);
  assert.ok(stroke.points.every(point => [point.x, point.y, point.t, point.pressure].every(Number.isFinite)));
  assert.ok(stroke.points.every((point, index, list) => point.pressure >= 0 && point.pressure <= 1 && (!index || point.t >= list[index - 1].t)));
  const button = page.getByRole('button', { name: 'Open ink detail', exact: true });
  await button.click();
  assert.equal(await page.evaluate(() => window.inkActions), 1);
  assert.equal(await page.evaluate(() => window.inkStrokes.length), 1);
  await stage.focus();
  await stage.press('ArrowRight');
  await stage.press('Enter');
  await page.waitForFunction(() => window.inkStrokes.length === 2);
  assert.equal(await page.evaluate(() => window.inkStrokes[1].kind), 'seal');
  await stage.press('Backspace');
  await page.waitForFunction(() => window.inkClears === 1 && document.querySelector('[data-demo="ink-clear"]').disabled);
  await mount(`window.disabledInkStrokes=[];createRoot(document.getElementById('root')).render(<Subject.EffectInkTrail disabled initialStrokes={[]} height={NaN} width={Infinity} onStroke={stroke=>window.disabledInkStrokes.push(stroke)}/>);`);
  assert.equal(await stage.getAttribute('aria-disabled'), 'true');
  await stage.focus();
  await stage.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.disabledInkStrokes), []);
  assert.equal(await page.locator('[data-demo="ink-seal"]').isDisabled(), true);
  assert.equal(await stage.evaluate(node => Number.isFinite(node.getBoundingClientRect().height)), true);
}
