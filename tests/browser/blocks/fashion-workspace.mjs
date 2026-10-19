import { check as checkCalendarWrites } from '../review/fashion-calendar-writes.mjs';

export async function check(context) {
  const { page, mount, assert, capture = async () => {} } = context;
  const viewport = page.viewportSize();
  const tab = async name => {
    const control = page.getByRole('tab', { name, exact: true });
    await control.focus();
    await control.press('Enter');
  };
  const collection = async name => {
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name, exact: true }).click();
  };
  const plan = () => page.locator('[data-workspace-panel="autumn-planning"]');
  const created = () => plan().locator('[data-demo="option-outer-new-1"]');
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  try {
    await page.setViewportSize({ width: 1440, height: 940 });
    await mount(`window.planJobs=[];createRoot(document.getElementById('root')).render(<Subject.FashionWorkspace brand="Dover Goods" onSavePlan={payload=>new Promise((resolve,reject)=>window.planJobs.push({payload:structuredClone(payload),resolve,reject}))}/>);`);
    for (const [name, heading] of [['Performance', 'Collection overview'], ['Line plan', 'Collection plan'], ['Launches', 'Launch calendar']]) {
      await tab(name);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      const pane = page.getByRole('tabpanel', { name, exact: true });
      assert.equal((await pane.getByRole('navigation', { name: 'Breadcrumb', exact: true }).innerText()).split('/')[0].trim(), 'Dover Goods');
      await capture('brand-' + name.toLowerCase().replaceAll(' ', '-'), { audit: true });
    }
    await tab('Line plan');
    await plan().getByRole('button', { name: 'Add a style to Outerwear', exact: true }).click();
    await created().waitFor();
    await collection('A lighter chapter');
    assert.equal(await page.getByRole('button', { name: 'Add a style to Shirting', exact: true }).count(), 1);
    await collection('The quiet season');
    await created().waitFor();
    await capture('retained-line-plan', { audit: true });
    await plan().getByRole('button', { name: 'Save line plan', exact: true }).click();
    await page.waitForFunction(() => window.planJobs.length === 1);
    assert.equal(await plan().getByRole('button', { name: 'Saving', exact: true }).isDisabled(), true);
    assert.equal(await plan().getByRole('button', { name: 'Add a style to Outerwear', exact: true }).isDisabled(), true);
    await collection('A lighter chapter');
    await page.evaluate(() => window.planJobs[0].reject(Error('Buying approval unavailable')));
    await settle();
    assert.equal(await page.getByRole('alert').count(), 0, 'A rejected save stays with its original collection');
    assert.equal(await plan().evaluate(node => node.hasAttribute('inert') && node.getAttribute('aria-hidden') === 'true'), true);
    await collection('The quiet season');
    await plan().getByRole('alert').filter({ hasText: 'Buying approval unavailable' }).waitFor();
    await plan().getByRole('alert').filter({ hasText: 'Buying approval unavailable' }).scrollIntoViewIfNeeded();
    await created().waitFor();
    await capture('rejected-line-plan', { audit: true });
    await plan().getByRole('button', { name: 'Save again', exact: true }).click();
    await page.waitForFunction(() => window.planJobs.length === 2);
    await page.evaluate(() => window.planJobs[1].resolve());
    await plan().getByRole('status').filter({ hasText: 'Line plan saved' }).waitFor();
    await capture('saved-line-plan', { audit: true });
    const calls = await page.evaluate(() => window.planJobs.map(job => job.payload));
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], calls[1], 'Retry retains the complete reviewed snapshot');
    assert.equal(calls[1].collectionId, 'autumn');
    assert.deepEqual(calls[1].plan.categories.map(category => ({ id: category.id, styles: category.styles, unitsPerStyle: category.unitsPerStyle })), [
      { id: 'outer', styles: 7, unitsPerStyle: 30 }, { id: 'knit', styles: 8, unitsPerStyle: 40 },
    ]);
    assert.deepEqual({ units: calls[1].plan.totalUnits, cost: calls[1].plan.costMinor, retail: calls[1].plan.retailMinor }, { units: 530, cost: 1776000, retail: 6468000 });
    assert.equal(calls[1].plan.categories[0].options.at(-1).id, 'outer-new-1');

    await mount(`function Host(){const[scopes,setScopes]=React.useState([]);window.loadCollection=()=>setScopes([{id:'opening',label:'Opening collection',collections:[],categories:[],budgetMinor:0,launches:[]}]);return <Subject.FashionWorkspace scopes={scopes}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
    assert.equal(await page.getByText('No collections yet.', { exact: true }).count(), 1);
    assert.equal((await page.getByRole('combobox').innerText()).trim(), 'No collections');
    assert.equal(await page.getByRole('combobox').isDisabled(), true);
    await capture('empty-collections', { audit: true });
    await page.evaluate(() => window.loadCollection());
    await page.getByRole('combobox').filter({ hasText: 'Opening collection' }).waitFor();
    assert.equal(await page.getByRole('combobox').isDisabled(), false);
    await capture('arriving-performance', { audit: true });
    await tab('Line plan');
    await page.getByText('No categories in this line yet', { exact: true }).waitFor();
    await capture('arriving-empty-plan', { audit: true });
    await tab('Launches');
    await capture('arriving-empty-launches', { audit: true });

    await mount(`createRoot(document.getElementById('root')).render(<Subject.FashionWorkspace/>);`);
    await tab('Line plan');
    await plan().getByRole('button', { name: 'Add a style to Outerwear', exact: true }).click();
    await created().waitFor();
    assert.equal(await plan().getByRole('button', { name: /Save line plan|Save again/ }).count(), 0, 'A missing writer cannot acknowledge persistence');
    await capture('local-plan-without-writer', { audit: true });
    await tab('Launches');
    await page.getByRole('button', { name: 'One day later', exact: true }).click();
    assert.match(await page.getByRole('complementary', { name: 'Launch details', exact: true }).innerText(), /Thu,?\s+15 Oct/i);
    assert.equal(await page.getByRole('button', { name: 'One day later', exact: true }).isDisabled(), false);
    await capture('local-launch-without-writer', { audit: true });

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 940 });
      await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
      const revenue = page.getByRole('group', { name: 'Collection figures', exact: true }).locator('dl').filter({ has: page.getByText('Net revenue', { exact: true }) }).locator('dd').first();
      assert.equal(await wordLineCount(revenue, '£28,200'), 1, 'The complete collection revenue amount remains on one line in a narrow pane');
      await tab('Line plan');
      await page.getByRole('button', { name: 'Add a style to Outerwear', exact: true }).click();
      const save = page.getByRole('button', { name: 'Save line plan', exact: true });
      await save.focus();
      assert.equal(await wordLineCount(page.getByRole('button', { name: 'Discard', exact: true }), 'Discard'), 1, 'The Discard word remains intact in a narrow plan');
      assert.equal(await save.evaluate(node => { const r = node.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === node; }), true, 'Focused plan save is reachable inside the phone pane');
      await capture('phone-' + width + '-plan', { audit: true });
      await save.press('Enter');
      await page.getByRole('status').filter({ hasText: 'Line plan saved' }).waitFor();
      await tab('Launches');
      const move = page.getByRole('button', { name: 'One day later', exact: true });
      await move.focus();
      await move.press('Enter');
      await page.waitForFunction(() => !document.querySelector('[aria-label="One day later"]').hasAttribute('aria-disabled'));
      assert.match(await page.getByRole('complementary', { name: 'Launch details', exact: true }).innerText(), /Thu,?\s+15 Oct/i);
      assert.equal(await wordLineCount(page.getByRole('complementary', { name: 'Launch details', exact: true }).getByText('Required checks done', { exact: true }), 'Required'), 1, 'The launch readiness word remains intact in a narrow panel');
      await capture('phone-' + width + '-launches', { audit: true });
    }
    await checkCalendarWrites({ ...context, capture });
  } finally {
    if (viewport) await page.setViewportSize(viewport);
  }
}

async function wordLineCount(locator, word) {
  return locator.evaluate((node, word) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const start = text.textContent.indexOf(word);
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(text, start);
      range.setEnd(text, start + word.length);
      return [...range.getClientRects()].filter(rect => rect.width && rect.height).length;
    }
    return 0;
  }, word);
}
