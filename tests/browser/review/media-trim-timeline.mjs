// Keyboard trim edges, playback notifications, exact retry payloads and absent media.
export async function check({ page, mount, assert }) {
  await mount(`window.trimChanges=[];window.trimJobs=[];window.trimPlayback=[];createRoot(document.getElementById('root')).render(<Subject.MediaTrimTimeline media={{id:'fixture',title:'Offline recording',duration:12,peaks:[.1,.3,.2,0,0,.4,.6,.3,.1,.2]}} defaultRange={{start:2,end:10}} minLength={1} step={.5} onRangeChange={range=>window.trimChanges.push({...range})} onApply={(range,signal)=>new Promise((resolve,reject)=>window.trimJobs.push({range:{...range},signal,resolve,reject}))} onPlaybackChange={playing=>window.trimPlayback.push(playing)}/>);`);
  const out = page.locator('[data-demo="trim-out"]');
  const start = page.locator('[data-demo="trim-in"]');
  await out.focus();
  await out.press('PageDown');
  await start.focus();
  await start.press('PageUp');
  await page.waitForFunction(() => window.trimChanges.length === 2);
  assert.deepEqual(await page.evaluate(() => window.trimChanges.at(-1)), { start: 3, end: 9 });
  await page.locator('[data-demo="play"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.trimPlayback.at(-1) === true);
  await page.locator('[data-demo="play"]').press('Space');
  await page.waitForFunction(() => window.trimPlayback.at(-1) === false);
  const apply = page.locator('[data-demo="trim-apply"]');
  await apply.focus();
  await apply.press('Enter');
  await page.waitForFunction(() => window.trimJobs.length === 1);
  assert.equal(await apply.getAttribute('aria-busy'), 'true');
  await page.evaluate(() => window.trimJobs[0].reject(Error('Clip service unavailable')));
  await page.waitForFunction(() => document.querySelector('[data-demo="trim-apply"]').textContent.includes('Try again'));
  assert.equal(await start.getAttribute('aria-valuenow'), '3');
  assert.equal(await out.getAttribute('aria-valuenow'), '9');
  await apply.focus();
  await apply.press('Space');
  await page.waitForFunction(() => window.trimJobs.length === 2);
  assert.deepEqual(await page.evaluate(() => window.trimJobs.map(job => job.range)), [{ start: 3, end: 9 }, { start: 3, end: 9 }]);
  await page.evaluate(() => window.trimJobs[1].resolve());
  await page.waitForFunction(() => document.querySelector('[data-demo="trim-apply"]').textContent.includes('Saved'));
  await page.locator('[data-demo="reset"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.trimChanges.at(-1)?.start === 2 && window.trimChanges.at(-1)?.end === 10);
  await mount(`window.chooseTrimMedia=0;createRoot(document.getElementById('root')).render(<Subject.MediaTrimTimeline media={null} onChooseMedia={()=>window.chooseTrimMedia++}/>);`);
  await page.getByRole('button', { name: 'Choose a file', exact: true }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.chooseTrimMedia), 1);
}
