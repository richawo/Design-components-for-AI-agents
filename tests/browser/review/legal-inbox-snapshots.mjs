export async function check({ page, mount, assert, capture = async () => {} }) {
  const attachment = { id: 'ATT-42', name: 'quarterly-report.pdf', bytes: 4096, from: 'Avery Kim', receivedLabel: '12 Oct 2026' };
  const scope = { id: 'MAT-A', label: 'Service agreement', matters: [], obligations: [], requests: [{
    id: 'DOC-A', title: 'Quarterly report', description: 'The complete signed report.', requestedBy: 'Avery Kim',
    dueLabel: '18 October 2026', state: 'awaiting', allowedExtensions: ['.pdf'], maxBytes: 10000, suggestion: attachment,
  }] };
  await mount(`window.inboxScope=${JSON.stringify(scope)};window.inboxCalls=[];window.inboxPayloads=[];createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace scopes={[window.inboxScope]} onUpload={payload=>{window.inboxCalls.push(structuredClone(payload));window.inboxPayloads.push(payload);payload.submission.attachment.name='corrupted.pdf';payload.submission.attachment.bytes=1;if(window.inboxCalls.length===1)throw Error('offline')}}/>);`);
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  const documents = page.locator('[data-workspace-panel="MAT-A-documents"]');
  await documents.locator('[data-demo="attach-doc-a"]').click();
  await documents.getByRole('button', { name: 'Submit', exact: true }).click();
  await documents.getByRole('alert').filter({ hasText: 'The upload didn’t finish. The file is still attached.' }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.inboxScope.requests[0].suggestion), attachment, 'A rejected callback cannot mutate the host inbox record');
  await documents.getByRole('button', { name: 'Remove quarterly-report.pdf', exact: true }).waitFor();
  await documents.getByRole('alert').scrollIntoViewIfNeeded();
  await capture('inbox-rejected-snapshot', { audit: true });
  await documents.getByRole('button', { name: 'Try again', exact: true }).click();
  await documents.getByRole('status').filter({ hasText: 'Quarterly report received for review.' }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.inboxCalls), [0, 1].map(() => ({ matterId: 'MAT-A', submission: { requestId: 'DOC-A', attachment } })));
  assert.equal(await page.evaluate(() => window.inboxPayloads[0].submission.attachment !== window.inboxPayloads[1].submission.attachment && window.inboxPayloads[1].submission.attachment !== window.inboxScope.requests[0].suggestion), true, 'Each callback owns an independent attachment snapshot');
  assert.equal(await documents.getByRole('complementary', { name: 'Received documents' }).getByText('quarterly-report.pdf', { exact: true }).isVisible(), true);
  assert.equal(await documents.getByText('corrupted.pdf', { exact: true }).count(), 0);
  await documents.getByRole('complementary', { name: 'Received documents' }).getByText('quarterly-report.pdf', { exact: true }).scrollIntoViewIfNeeded();
  await capture('inbox-received-snapshot', { audit: true });

  await mount(`window.inboxScope=${JSON.stringify(scope)};window.inboxCalls=[];createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace scopes={[window.inboxScope]} onUpload={payload=>{window.inboxCalls.push(structuredClone(payload))}}/>);`);
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await documents.locator('[data-demo="attach-doc-a"]').click();
  await page.evaluate(() => { window.inboxScope.requests[0].suggestion.name = 'host-replacement.pdf'; window.inboxScope.requests[0].suggestion.bytes = 8192; });
  await documents.getByRole('button', { name: 'Submit', exact: true }).click();
  await documents.getByRole('status').filter({ hasText: 'Quarterly report received for review.' }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.inboxCalls[0].submission.attachment), attachment, 'Staging owns the selected inbox file before a later host change');
  assert.equal(await documents.getByRole('complementary', { name: 'Received documents' }).getByText('quarterly-report.pdf', { exact: true }).isVisible(), true);
  await documents.getByRole('complementary', { name: 'Received documents' }).getByText('quarterly-report.pdf', { exact: true }).scrollIntoViewIfNeeded();
  await capture('inbox-staged-before-host-change', { audit: true });
}
