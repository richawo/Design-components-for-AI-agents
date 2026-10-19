export async function check({ page, mount, assert, capture = async () => {} }) {
  const scope = { id: 'MAT-A', label: 'Contract review', matters: [], obligations: [], requests: [
    { id: 'DOC-A', title: 'Insurance certificate', description: 'Current policy certificate.', requestedBy: 'Avery Kim',
      dueLabel: '20 October 2001', due: '2001-10-20', state: 'awaiting', allowedExtensions: ['.pdf'], maxBytes: 10000 },
  ] };
  await mount(`createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace scopes={[${JSON.stringify(scope)}]} referenceDate="2001-10-12"/>);`);
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  const documents = page.locator('[data-workspace-panel="MAT-A-documents"]');
  await documents.getByText('Due 20 Oct · 8 days', { exact: true }).waitFor();
  assert.equal(await documents.getByText('Due 20 Oct · 8 days', { exact: true }).isVisible(), true);
  await capture('shared-reference-date', { audit: true });
}
