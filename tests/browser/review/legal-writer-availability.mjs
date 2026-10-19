export async function check(options) {
  await checkCompletion(options);
  await checkDocuments(options);
}

export async function checkCompletion({ page, mount, assert, capture = async () => {} }) {
  await mount(`window.completions=[];function Host(){const[available,setAvailable]=React.useState(false);window.provideWriter=setAvailable;return <Subject.LegalWorkspace onComplete={available?payload=>{window.completions.push(payload)}:undefined}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.getByRole('tab', { name: 'Obligations', exact: true }).click();
  const obligations = page.locator('[data-workspace-panel="MAT-204-obligations"]');
  const evidence = obligations.getByRole('textbox', { name: 'Completion evidence', exact: true });
  const note = 'Report filed as DOC-204.';
  await evidence.fill(note);
  const record = obligations.getByRole('button', { name: 'Record completion', exact: true });
  assert.equal(await record.isDisabled(), true);
  assert.equal(await obligations.getByText('Completion recording is unavailable.', { exact: true }).isVisible(), true);
  await evidence.locator('xpath=ancestor::form').evaluate(form => form.requestSubmit());
  assert.deepEqual(await page.evaluate(() => window.completions), []);
  assert.equal(await evidence.inputValue(), note);
  await obligations.getByText('Completion recording is unavailable.', { exact: true }).scrollIntoViewIfNeeded();
  await capture('completion-writer-unavailable', { audit: true });
  await page.evaluate(() => window.provideWriter(true));
  await page.waitForFunction(() => !document.querySelector('[data-workspace-panel="MAT-204-obligations"] [data-demo="record"]').disabled);
  assert.equal(await evidence.inputValue(), note, 'Supplying a writer retains the evidence draft');
  await record.click();
  await obligations.getByRole('status').filter({ hasText: /Completion evidence recorded/ }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.completions.map(payload => ({ matterId: payload.matterId, completion: payload.completion }))), [{ matterId: 'MAT-204', completion: { obligationId: 'OB-014', evidence: note } }]);
  await capture('completion-writer-connected', { audit: true });
  const overlap = await obligations.locator('article').evaluate(article => {
    const stamp = [...article.querySelectorAll('span')].find(node => node.textContent === 'Done').parentElement.getBoundingClientRect();
    const body = article.querySelector('p.font-serif'), walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const rects = []; for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const range = document.createRange(); range.selectNodeContents(node); rects.push(...range.getClientRects());
    }
    return rects.some(rect => rect.right > stamp.left + 1 && rect.left < stamp.right - 1 && rect.bottom > stamp.top + 1 && rect.top < stamp.bottom - 1);
  });
  assert.equal(overlap, false, 'The completion stamp leaves every clause line readable');

}

export async function checkDocuments({ page, mount, assert, capture = async () => {} }) {
  await mount(`window.uploads=[];function Host(){const[available,setAvailable]=React.useState(false);window.provideWriter=setAvailable;return <Subject.LegalWorkspace onUpload={available?payload=>{window.uploads.push(payload)}:undefined}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  const documents = page.locator('[data-workspace-panel="MAT-204-documents"]');
  await documents.locator('input[type="file"]').setInputFiles({ name: 'schedule.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Fixture document') });
  const submit = documents.getByRole('button', { name: 'Submit', exact: true });
  assert.equal(await submit.isDisabled(), true);
  assert.equal(await documents.getByText('Document submission is unavailable.', { exact: true }).isVisible(), true);
  await submit.evaluate(button => button.click());
  assert.deepEqual(await page.evaluate(() => window.uploads), []);
  await documents.getByRole('button', { name: 'Remove schedule.pdf', exact: true }).waitFor();
  await documents.getByText('Document submission is unavailable.', { exact: true }).scrollIntoViewIfNeeded();
  await capture('document-writer-unavailable', { audit: true });
  const filenameLines = await documents.getByText('schedule.pdf', { exact: true }).evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    return new Set([...range.getClientRects()].filter(rect => rect.width).map(rect => Math.round(rect.top))).size;
  });
  assert.equal(filenameLines, 1, 'The short staged filename has room beside its thumbnail');
  await page.evaluate(() => window.provideWriter(true));
  await page.waitForFunction(() => !document.querySelector('[data-workspace-panel="MAT-204-documents"] [data-demo="submit-doc-401"]').disabled);
  await submit.click();
  await documents.getByRole('status').filter({ hasText: /received/ }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.uploads.map(payload => ({ matterId: payload.matterId, requestId: payload.submission.requestId, file: payload.submission.file.name, bytes: payload.submission.file.size }))), [{ matterId: 'MAT-204', requestId: 'DOC-401', file: 'schedule.pdf', bytes: 16 }]);
  await capture('document-writer-connected', { audit: true });
  const contrast = await documents.locator('span.pointer-events-none').filter({ hasText: 'Received' }).evaluate(stamp => {
    const rgb = value => value.startsWith('#')
      ? [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16))
      : value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = value => rgb(value).map(channel => channel / 255)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const style = getComputedStyle(stamp), foreground = luminance(style.color), paper = luminance(style.getPropertyValue('--lg-paper').trim());
    return (Math.max(foreground, paper) + .05) / (Math.min(foreground, paper) + .05);
  });
  assert.ok(contrast >= 4.5, `The received stamp stays readable on paper (${contrast.toFixed(2)}:1)`);
}
