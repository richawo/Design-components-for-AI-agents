// Offline image failure/retry, exact scene states and preserved foreground controls.
export async function check({ page, mount, assert }) {
  let requests = 0;
  const pattern = '**/__handoff_glass_scene.svg';
  await page.route(pattern, route => {
    requests++;
    return requests === 1
      ? route.fulfill({ status: 503, contentType: 'text/plain', body: 'Unavailable', headers: { 'cache-control': 'no-store' } })
      : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><path fill="#777" d="M0 0h200v100H0z"/><circle cx="100" cy="50" r="30" fill="white"/></svg>' });
  });
  try {
    await mount(`window.glassStates=[];window.glassActions=0;createRoot(document.getElementById('root')).render(<Subject.BgFlutedGlass scene={{src:'/__handoff_glass_scene.svg',description:'Local monochrome scene'}} className="h-[420px]" onSceneStateChange={state=>window.glassStates.push({...state})}><button onClick={()=>window.glassActions++}>Open foreground detail</button></Subject.BgFlutedGlass>);`);
    await page.getByRole('alert').filter({ hasText: 'couldn’t load' }).waitFor();
    assert.ok(await page.evaluate(() => window.glassStates.some(state => state.status === 'error')));
    const retry = page.getByRole('button', { name: 'Retry', exact: true });
    await retry.focus();
    await retry.press('Enter');
    await page.waitForFunction(() => document.querySelector('.fg-root').dataset.sceneState === 'ready');
    const ready = await page.evaluate(() => window.glassStates.at(-1));
    assert.deepEqual(ready, { status: 'ready', width: 200, height: 100 });
    assert.equal(await page.getByRole('alert').count(), 0);
    const action = page.getByRole('button', { name: 'Open foreground detail', exact: true });
    await action.focus();
    await action.press('Space');
    assert.equal(await page.evaluate(() => window.glassActions), 1);
    assert.equal(await action.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('.fg-content').evaluate(node => getComputedStyle(node).filter), 'none');
    assert.equal(await page.locator('.fg-scene image').count(), 1);
    await mount(`createRoot(document.getElementById('root')).render(<Subject.BgFlutedGlass className="h-[300px]"><p>Foreground stays available.</p></Subject.BgFlutedGlass>);`);
    assert.equal(await page.locator('.fg-root').getAttribute('data-scene-state'), 'empty');
    assert.equal(await page.getByText('Foreground stays available.', { exact: true }).isVisible(), true);
    await mount(`createRoot(document.getElementById('root')).render(<Subject.BgFlutedGlass strength={NaN} radius={Infinity} flutes={0} className="h-[300px]"><p>Invalid effect settings.</p></Subject.BgFlutedGlass>);`);
    await page.getByRole('alert').filter({ hasText: 'out of range' }).waitFor();
    assert.doesNotMatch(await page.locator('.fg-root').getAttribute('style'), /NaN|Infinity/);
  } finally { await page.unroute(pattern); }
}
