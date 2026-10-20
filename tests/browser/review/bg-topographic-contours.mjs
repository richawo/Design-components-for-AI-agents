// Exact field sampling, flat/invalid replacements and preserved foreground controls.
export async function check({ page, mount, assert }) {
  await mount(`window.contourProbes=[];window.contourActions=0;function Host(){const[field,setField]=React.useState({columns:2,rows:2,values:[0,10,20,30]});window.replaceContourField=setField;return <Subject.BgTopographicContours field={field} className="h-[420px]" onProbe={probe=>window.contourProbes.push(probe?{...probe}:null)}><button onClick={()=>window.contourActions++}>Open contour detail</button></Subject.BgTopographicContours>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const surface = page.locator('[data-field-state]');
  assert.equal(await surface.getAttribute('data-field-state'), 'ready');
  const box = await surface.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.contourProbes.some(Boolean));
  const probe = await page.evaluate(() => window.contourProbes.at(-1));
  assert.ok(Math.abs(probe.x - 0.5) < 0.005 && Math.abs(probe.y - 0.5) < 0.005);
  assert.ok(Math.abs(probe.value - 15) < 0.05);
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => window.contourProbes.at(-1) === null);
  const button = page.getByRole('button', { name: 'Open contour detail', exact: true });
  await button.focus();
  await button.press('Enter');
  assert.equal(await page.evaluate(() => window.contourActions), 1);
  assert.equal(await button.evaluate(node => node === document.activeElement), true);
  const drawn = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
  await page.evaluate(() => window.replaceContourField({ columns: 2, rows: 2, values: [5, 5, 5, 5] }));
  await page.waitForFunction(() => document.querySelector('[data-field-state]').dataset.fieldState === 'flat');
  await page.waitForFunction(before => document.querySelector('canvas').toDataURL() !== before, drawn);
  await page.evaluate(() => window.replaceContourField({ columns: 2, rows: 2, values: [] }));
  await page.waitForFunction(() => document.querySelector('[data-field-state]').dataset.fieldState === 'invalid');
  await button.focus();
  await button.press('Space');
  assert.equal(await page.evaluate(() => window.contourActions), 2);
}
