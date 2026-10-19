export async function check({ page, mount, assert, capture = async () => {} }) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace/>);`);
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Harbour premises review', exact: true }).click();
  const documents = page.locator('[data-workspace-panel="MAT-205-documents"]');
  const oldFile = documents.getByText('insurance-previous.pdf', { exact: true });
  await oldFile.scrollIntoViewIfNeeded();
  assert.equal(await oldFile.evaluate(node => getComputedStyle(node).textDecorationLine), 'line-through');
  assert.equal(await documents.getByText('The previous certificate ended before the requested period. Please provide the current revision.', { exact: true }).isVisible(), true);
  await capture('revision-previous-file', { audit: true });
  await documents.locator('input[type="file"]').setInputFiles({ name: 'insurance-current.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Current insurance') });
  await documents.getByRole('button', { name: 'Remove insurance-current.pdf', exact: true }).waitFor();
  assert.equal(await oldFile.isVisible(), true, 'Staging a replacement retains the reviewer explanation and previous file');
  await capture('revision-replacement-staged', { audit: true });
}
