import { check as checkPhaseLabels } from '../review/legal-matter-phase-labels.mjs';
import { check as checkEmptyMatterTable } from '../review/legal-empty-matter-table.mjs';
import { check as checkDocumentRevision } from '../review/legal-document-revision.mjs';
import { check as checkMatterSemantics } from '../review/legal-matter-semantics.mjs';
import { check as checkInboxSnapshots } from '../review/legal-inbox-snapshots.mjs';
import { check as checkWriterAvailability } from '../review/legal-writer-availability.mjs';
import { check as checkReferenceDate } from '../review/legal-reference-date.mjs';
export async function check(context) {
  const { page, mount, assert, capture = async () => {} } = context;
  const viewport = page.viewportSize();
  const review = label => capture(label, { audit: true });
  const tab = async name => { const control = page.getByRole('tab', { name, exact: true }); await control.focus(); await control.press('Enter'); };
  const matter = async name => { await page.getByRole('combobox').first().click(); await page.getByRole('option', { name, exact: true }).click(); };
  const panel = (id, view) => page.locator(`[data-workspace-panel="${id}-${view}"]`);
  const scope = (id, label) => ({ id, label, matters: [], obligations: [{ id: 'OB-SHARED', contract: label, title: 'File the quarterly report', owner: 'Avery Kim', due: '2026-10-18', clause: 'Schedule 2, paragraph 4', detail: 'Record the signed reporting pack against this matter.', complete: false }], requests: [{ id: 'DOC-SHARED', title: 'Current service schedule', description: 'The complete signed service schedule.', requestedBy: 'Avery Kim', dueLabel: '23 October 2026', state: 'awaiting', allowedExtensions: ['.pdf'], maxBytes: 10000 }] });
  const scopes = [scope('MAT-A', 'First service agreement'), scope('MAT-B', 'Second service agreement')];
  try {
    await page.setViewportSize({ width: 1440, height: 940 });
    await mount(`createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace brand="Lex Spring"/>);`);
    for (const [name, id] of [['Matter', 'matter'], ['Obligations', 'obligations'], ['Documents', 'documents']]) {
      await tab(name);
      await panel('MAT-204', id).getByRole('heading', { name: 'Lex Spring', exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { level: 2, name: 'Northline supply agreement', exact: true }).isVisible(), true);
      await review('brand-' + id);
    }
    await page.getByRole('combobox').first().focus();
    await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.getByRole('heading', { level: 2, name: 'Harbour premises review', exact: true }).waitFor();
    assert.equal(await page.getByRole('combobox').first().evaluate(node => node === document.activeElement), true);
    await tab('Obligations');
    assert.equal(await panel('MAT-205', 'obligations').getByText('Handover record filed as DOC-403.', { exact: true }).isVisible(), true);
    await tab('Documents');
    assert.equal(await panel('MAT-205', 'documents').getByText('Signed handover record', { exact: true }).first().isVisible(), true);
    await review('coherent-handover-record');

    await mount(`window.completionJobs=[];window.uploadJobs=[];createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace scopes={${JSON.stringify(scopes)}} onComplete={payload=>new Promise((resolve,reject)=>window.completionJobs.push({payload,resolve,reject}))} onUpload={payload=>new Promise((resolve,reject)=>window.uploadJobs.push({payload,resolve,reject}))}/>);`);
    await tab('Obligations');
    const evidenceA = panel('MAT-A', 'obligations').getByRole('textbox', { name: 'Completion evidence', exact: true });
    await evidenceA.fill('First agreement evidence filed as DOC-A.');
    await panel('MAT-A', 'obligations').getByRole('button', { name: 'Record completion', exact: true }).click();
    await page.waitForFunction(() => window.completionJobs.length === 1);
    await matter('Second service agreement');
    await panel('MAT-B', 'obligations').getByRole('textbox', { name: 'Completion evidence', exact: true }).fill('Second agreement evidence filed as DOC-B.');
    await panel('MAT-B', 'obligations').getByRole('button', { name: 'Record completion', exact: true }).click();
    await page.waitForFunction(() => window.completionJobs.length === 2);
    await review('independent-pending-completions');
    await page.evaluate(() => window.completionJobs[0].reject(Error('offline')));
    assert.equal(await page.getByRole('alert').count(), 0, 'A hidden matter cannot expose its failure in the selected matter');
    await page.evaluate(() => window.completionJobs[1].resolve());
    await panel('MAT-B', 'obligations').getByRole('status').filter({ hasText: 'Completion evidence recorded' }).waitFor();
    await matter('First service agreement');
    await panel('MAT-A', 'obligations').getByRole('alert').filter({ hasText: 'Couldn’t record it. Your evidence and file are kept.' }).waitFor();
    assert.equal(await evidenceA.inputValue(), 'First agreement evidence filed as DOC-A.');
    await review('retained-completion-failure');
    await panel('MAT-A', 'obligations').getByRole('button', { name: 'Try again', exact: true }).click();
    await page.waitForFunction(() => window.completionJobs.length === 3);
    await page.evaluate(() => window.completionJobs[2].resolve());
    await panel('MAT-A', 'obligations').getByRole('status').filter({ hasText: 'Completion evidence recorded' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.completionJobs.map(job => job.payload)), [
      { matterId: 'MAT-A', completion: { obligationId: 'OB-SHARED', evidence: 'First agreement evidence filed as DOC-A.' } },
      { matterId: 'MAT-B', completion: { obligationId: 'OB-SHARED', evidence: 'Second agreement evidence filed as DOC-B.' } },
      { matterId: 'MAT-A', completion: { obligationId: 'OB-SHARED', evidence: 'First agreement evidence filed as DOC-A.' } },
    ]);
    await review('completion-retry-receipt');

    await tab('Documents');
    const inputA = panel('MAT-A', 'documents').locator('input[type="file"]');
    await inputA.setInputFiles({ name: 'first-schedule.pdf', mimeType: 'application/pdf', buffer: Buffer.from('First agreement') });
    await panel('MAT-A', 'documents').getByRole('button', { name: 'Submit', exact: true }).click();
    await matter('Second service agreement');
    await panel('MAT-B', 'documents').locator('input[type="file"]').setInputFiles({ name: 'second-schedule.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Second agreement') });
    await panel('MAT-B', 'documents').getByRole('button', { name: 'Submit', exact: true }).click();
    await page.waitForFunction(() => window.uploadJobs.length === 2);
    await review('independent-pending-uploads');
    await page.evaluate(() => window.uploadJobs[0].reject(Error('offline')));
    assert.equal(await page.getByRole('alert').count(), 0);
    await page.evaluate(() => window.uploadJobs[1].resolve());
    await panel('MAT-B', 'documents').getByRole('status').filter({ hasText: 'received for review' }).waitFor();
    await matter('First service agreement');
    await panel('MAT-A', 'documents').getByRole('alert').filter({ hasText: 'The upload didn’t finish. The file is still attached.' }).waitFor();
    await panel('MAT-A', 'documents').getByRole('button', { name: 'Remove first-schedule.pdf', exact: true }).waitFor();
    await review('retained-upload-failure');
    await panel('MAT-A', 'documents').getByRole('button', { name: 'Try again', exact: true }).click();
    await page.waitForFunction(() => window.uploadJobs.length === 3);
    await page.evaluate(() => window.uploadJobs[2].resolve());
    await panel('MAT-A', 'documents').getByRole('status').filter({ hasText: 'received for review' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.uploadJobs.map(({ payload }) => ({ matterId: payload.matterId, requestId: payload.submission.requestId, file: payload.submission.file.name }))), [
      { matterId: 'MAT-A', requestId: 'DOC-SHARED', file: 'first-schedule.pdf' },
      { matterId: 'MAT-B', requestId: 'DOC-SHARED', file: 'second-schedule.pdf' },
      { matterId: 'MAT-A', requestId: 'DOC-SHARED', file: 'first-schedule.pdf' },
    ]);
    assert.equal(await page.evaluate(() => window.uploadJobs[0].payload.submission.file === window.uploadJobs[2].payload.submission.file), true, 'An uploaded File keeps its identity across retry');
    await review('upload-retry-receipt');

    await mount(`window.pending=[];function Host(){const[items,setItems]=React.useState(${JSON.stringify(scopes)});window.replaceScopes=setItems;return <Subject.LegalWorkspace scopes={items} onComplete={payload=>new Promise(resolve=>window.pending.push({payload,resolve}))}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
    await tab('Obligations');
    await evidenceA.fill('Evidence for a matter that will be removed.');
    await panel('MAT-A', 'obligations').getByRole('button', { name: 'Record completion', exact: true }).click();
    await page.waitForFunction(() => window.pending.length === 1);
    await page.evaluate(() => window.replaceScopes([]));
    await page.locator('[role="tabpanel"] > p').filter({ hasText: /^No matters yet\.$/ }).waitFor();
    assert.equal(await page.getByRole('combobox').isDisabled(), true);
    await page.waitForFunction(() => document.querySelector('[role="combobox"]').innerText.trim() === 'No matters');
    assert.equal((await page.getByRole('combobox').innerText()).trim(), 'No matters');
    await review('empty-matters');
    await page.evaluate(() => window.pending[0].resolve());
    await page.evaluate(data => window.replaceScopes(data), scopes);
    await panel('MAT-A', 'obligations').getByRole('textbox', { name: 'Completion evidence', exact: true }).waitFor();
    assert.equal(await evidenceA.inputValue(), '', 'Removed panels cannot publish a late receipt into a new instance');
    assert.equal(await page.getByRole('status').filter({ hasText: 'Completion evidence recorded' }).count(), 0);
    await review('returned-matter');

    const empty = { id: 'NEW', label: 'New agreement', matters: [], obligations: [], requests: [] };
    await mount(`function Host(){const[items,setItems]=React.useState([]);window.replaceScopes=setItems;return <Subject.LegalWorkspace scopes={items}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
    await page.evaluate(data => window.replaceScopes(data), [{ ...empty, id: '' }, empty, { ...empty, label: 'Duplicate agreement' }]);
    await page.getByRole('combobox').click();
    assert.deepEqual((await page.getByRole('option').allTextContents()).map(text => text.trim()), ['New agreement']);
    await page.keyboard.press('Escape');
    for (const [name, id] of [['Matter', 'matter'], ['Obligations', 'obligations'], ['Documents', 'documents']]) {
      await tab(name);
      assert.equal(await panel('NEW', id).isVisible(), true);
      await review('arriving-empty-' + id);
    }

    await page.setViewportSize({ width: 320, height: 940 });
    await mount(`createRoot(document.getElementById('root')).render(<Subject.default brand="Lex Spring Commercial and Property" scopes={[${JSON.stringify({ ...scopes[0], label: 'A long service agreement for the Northline international operations team' })}]} referenceDate="not-a-date"/>);`);
    for (const name of ['Matter', 'Obligations', 'Documents']) {
      await tab(name);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.equal((await panel('MAT-A', name.toLowerCase()).innerText()).includes('NaN'), false, 'An invalid reporting date cannot create NaN labels');
      await review('phone-long-' + name.toLowerCase());
    }
    assert.equal((await page.locator('footer').innerText()).includes(await page.evaluate(() => new Date().toISOString().slice(0, 10))), true, 'Every view uses the same valid fallback reporting day');
    await page.setViewportSize({ width: 1440, height: 1800 });
    await mount(`window.instanceCalls=[];createRoot(document.getElementById('root')).render(<><div data-instance="A"><Subject.LegalWorkspace brand="Firm A" scopes={${JSON.stringify(scopes)}} onComplete={payload=>window.instanceCalls.push(['A',payload])}/></div><div data-instance="B"><Subject.LegalWorkspace brand="Firm B" scopes={${JSON.stringify(scopes)}} onComplete={payload=>window.instanceCalls.push(['B',payload])}/></div></>);`);
    const second = page.locator('[data-instance="B"]');
    await second.getByRole('tab', { name: 'Obligations', exact: true }).click();
    await second.getByRole('textbox', { name: 'Completion evidence', exact: true }).fill('Independent matter evidence for Firm B.');
    await second.getByRole('button', { name: 'Record completion', exact: true }).click();
    await second.getByRole('status').filter({ hasText: 'Completion evidence recorded' }).waitFor();
    assert.equal(await page.locator('[data-instance="A"]').getByRole('tab', { name: 'Matter', exact: true }).getAttribute('aria-selected'), 'true');
    assert.deepEqual(await page.evaluate(() => window.instanceCalls), [['B', { matterId: 'MAT-A', completion: { obligationId: 'OB-SHARED', evidence: 'Independent matter evidence for Firm B.' } }]]);
    const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(new Set(ids).size, ids.length, 'Independent workspaces keep distinct disclosure and panel IDs');
    await review('independent-workspaces');
    await page.setViewportSize({ width: 1440, height: 940 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
    await tab('Obligations');
    const active = page.getByRole('tab', { name: 'Obligations', exact: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.getAnimations().filter(animation => animation.playState === 'running').length === 0);
    assert.equal(await active.evaluate(node => node === document.activeElement), true);
    await review('live-reduced-motion');

    await page.setViewportSize({ width: 390, height: 940 });
    await checkLegacy({ ...context, capture: review });
  } finally {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (viewport) await page.setViewportSize(viewport);
  }
}

async function checkLegacy({ page, mount, assert, capture = async () => {} }) {
  const evidenceText = "Service report supplied; evidence reference DOC-204.";
  await mount(`window.calls=[];window.uploads=[];window.attempt=0;window.uploadAttempt=0;createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace onComplete={async payload=>{window.calls.push(payload);if(!window.attempt++)throw Error('fixture');}} onUpload={async payload=>{window.uploads.push(payload);if(!window.uploadAttempt++)throw Error('offline')}}/>);`);
  await page.getByRole("tab", { name: "Obligations", exact: true }).click();
  const obligations = page.locator('[data-workspace-panel="MAT-204-obligations"]');
  const note = obligations.getByRole("textbox", { name: "Completion evidence", exact: true });
  await note.fill(evidenceText);

  // A matter switch keeps the original matter's evidence draft mounted.
  const selector = page.getByRole("combobox").first();
  await selector.click();
  const labels = await page.getByRole("option").allTextContents();
  await page.getByRole("option").last().click();
  await selector.click();
  await page.getByRole("option", { name: labels[0].trim(), exact: true }).click();
  assert.equal(await note.inputValue(), evidenceText);

  // Current parts expose an alert and a Try again action on rejection.
  await obligations.getByRole("button", { name: "Record completion", exact: true }).click();
  await obligations.getByRole("alert").filter({ hasText: "Couldn’t record it. Your evidence and file are kept." }).waitFor();
  assert.equal(await note.inputValue(), evidenceText);
  await obligations.getByRole("button", { name: "Try again", exact: true }).click();
  await obligations.getByRole("status").filter({ hasText: /Completion evidence recorded/ }).waitFor();
  assert.deepEqual(await page.evaluate(() => ({ matterId: window.calls.at(-1).matterId, evidence: window.calls.at(-1).completion.evidence })), { matterId: "MAT-204", evidence: evidenceText });

  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  const documents = page.locator('[data-workspace-panel="MAT-204-documents"]');
  await documents.locator('input[type="file"]').setInputFiles({ name: "schedule.pdf", mimeType: "application/pdf", buffer: Buffer.from("Fixture document") });
  await documents.getByRole("button", { name: "Submit", exact: true }).click();
  await documents.getByRole("alert").filter({ hasText: "The upload didn’t finish. The file is still attached." }).waitFor();
  await documents.getByRole("button", { name: "Remove schedule.pdf", exact: true }).waitFor();
  await documents.getByRole("button", { name: "Try again", exact: true }).click();
  await page.waitForFunction(() => window.uploads.length === 2);
  assert.deepEqual(await page.evaluate(() => ({ matterId: window.uploads[1].matterId, requestId: window.uploads[1].submission.requestId, file: window.uploads[1].submission.file.name })), { matterId: "MAT-204", requestId: "DOC-401", file: "schedule.pdf" });
  await documents.getByRole("status").filter({ hasText: /received/ }).waitFor();

  await mount(`createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace scopes={[]}/>);`);
  assert.ok(await page.getByText("No matters yet.").isVisible());
  await checkReferenceDate({ page, mount, assert, capture });
  await checkWriterAvailability({ page, mount, assert, capture });
  await checkInboxSnapshots({ page, mount, assert, capture });
  await checkMatterSemantics({ page, mount, assert, capture });
  await checkDocumentRevision({ page, mount, assert, capture });
  await checkEmptyMatterTable({ page, mount, assert, capture });
  await checkPhaseLabels({ page, mount, assert, capture });
}
