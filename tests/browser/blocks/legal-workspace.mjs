import { check as checkDocumentRevision } from '../review/legal-document-revision.mjs';
import { check as checkMatterSemantics } from '../review/legal-matter-semantics.mjs';
import { check as checkInboxSnapshots } from '../review/legal-inbox-snapshots.mjs';
import { check as checkWriterAvailability } from '../review/legal-writer-availability.mjs';
import { check as checkReferenceDate } from '../review/legal-reference-date.mjs';
export async function check({ page, mount, assert, capture = async () => {} }) {
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
  assert.ok(await page.getByText("No matter records supplied.").isVisible());
  await checkReferenceDate({ page, mount, assert, capture });
  await checkWriterAvailability({ page, mount, assert, capture });
  await checkInboxSnapshots({ page, mount, assert, capture });
  await checkMatterSemantics({ page, mount, assert, capture });
  await checkDocumentRevision({ page, mount, assert, capture });
}
