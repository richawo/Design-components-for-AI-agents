const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
const file = (name, bytes, mimeType = "application/pdf") => ({ name, mimeType, buffer: Buffer.alloc(bytes, 37) });

export async function check({ page, mount, assert }) {
  await mount(`window.uploads=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.DocumentRequests referenceDate="2026-10-17" onUpload={async p=>{window.uploads.push(p.file?{requestId:p.requestId,file:{name:p.file.name,size:p.file.size,isFile:p.file instanceof File},hasAttachment:p.attachment!==undefined}:{requestId:p.requestId,attachment:p.attachment});if(window.fail)throw Error('offline')}}/>);`);
  const root = page.getByRole("region", { name: "Document requests, Harbour Works · Lease renewal" });
  const header = root.locator("header").first();
  const tray = page.getByRole("complementary", { name: "Received documents" });
  const row = (id) => page.locator(`[data-demo="request-${id}"]`);
  const input = page.locator('input[type="file"]');
  const alert = page.getByRole("alert");
  const announced = (re) => page.getByRole("status").filter({ hasText: re }).waitFor();

  // A checklist with due countdowns from the reference date; the first outstanding request is open.
  assert.match(await txt(header), /2 of 5 3 still needed/);
  assert.equal(await row("doc-401").getAttribute("aria-expanded"), "true");
  assert.equal(await row("doc-402").getAttribute("aria-expanded"), "false");
  assert.match(await txt(row("doc-401")), /Due 23 Oct · 6 days/);
  assert.match(await txt(row("doc-402")), /Due 21 Oct · 4 days/);
  assert.match(await txt(row("doc-402")), /Revision requested/);
  assert.match(await txt(row("doc-404")), /Received SC-accounts-FY2025\.xlsx/);
  assert.match(await txt(row("doc-405")), /Accepted · asbestos-survey-2023\.pdf/);
  assert.match(await txt(tray), /2 files/);

  // Validation names the file and keeps the request open.
  await input.setInputFiles(file("lease-scan.docx", 2048, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
  await alert.filter({ hasText: "lease-scan.docx isn’t a PDF file." }).waitFor();
  await input.setInputFiles(file("lease-empty.pdf", 0));
  await alert.filter({ hasText: "lease-empty.pdf is empty. Choose the complete file." }).waitFor();
  assert.equal(await page.locator('[data-demo="submit-doc-401"]').count(), 0);

  // Claim the inbox match; the host rejects the first send and the attachment stays staged.
  await page.locator('[data-demo="attach-doc-401"]').click();
  await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
  const submit401 = page.locator('[data-demo="submit-doc-401"]');
  await submit401.waitFor();
  assert.match(await txt(root), /Harbour_​?Lease_​?2019_​?signed\.​?pdf/);
  assert.match(await txt(root), /5\.9 MB · from the matter inbox/);
  await submit401.click();
  await alert.filter({ hasText: "The upload didn’t finish. The file is still attached." }).waitFor();
  await announced(/Signed lease, 2019 counterpart wasn’t received\. The file is still attached\./);
  assert.match(await txt(submit401), /Try again/);
  assert.match(await txt(header), /2 of 5/);
  assert.match(await txt(tray), /2 files/);

  await page.evaluate(() => (window.fail = false));
  await submit401.click();
  await announced(/Signed lease, 2019 counterpart received for review\./);
  assert.equal(await page.evaluate(() => window.uploads.length), 2);
  assert.deepEqual(await page.evaluate(() => window.uploads[1]), {
    requestId: "DOC-401",
    attachment: {
      id: "inbox-2291",
      name: "Harbour_Lease_2019_signed.pdf",
      bytes: 6214118,
      from: "Maya Okafor",
      receivedLabel: "email, today 09:41",
    },
  });
  // Received, not accepted: acceptance stays with the reviewer.
  await header.filter({ hasText: /3 of 5/ }).waitFor();
  assert.match(await txt(header), /2 still needed/);
  assert.match(await txt(row("doc-401")), /Received Harbour_​?Lease/);
  assert.doesNotMatch(await txt(row("doc-401")), /Accepted/);
  await tray.filter({ hasText: /3 files/ }).waitFor();
  assert.match(await txt(tray.getByRole("listitem").filter({ hasText: "Signed lease, 2019 counterpart" })), /Received 17 Oct/i);
  // The next outstanding request opens, with the reviewer's note.
  assert.equal(await row("doc-401").getAttribute("aria-expanded"), "false");
  assert.equal(await row("doc-402").getAttribute("aria-expanded"), "true");
  assert.match(await txt(root), /Jordan Blake asked for a new version/);
  assert.match(await txt(root), /expired on 30 September/);

  // Too large for this request's limit.
  await input.setInputFiles(file("cert-scan.pdf", 5_400_000));
  await alert.filter({ hasText: "cert-scan.pdf is 5.1 MB. The limit is 5.0 MB." }).waitFor();
  // A valid file clears the error; Remove unstages it.
  await input.setInputFiles(file("insurance-2026-27.pdf", 120_000));
  await page.getByRole("button", { name: "Remove insurance-2026-27.pdf" }).waitFor();
  await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
  assert.match(await txt(root), /117 KB · ready/);
  await page.getByRole("button", { name: "Remove insurance-2026-27.pdf" }).click();
  await page.getByRole("button", { name: "Choose file" }).waitFor();
  await input.setInputFiles(file("insurance-2026-27.pdf", 120_000));
  await page.locator('[data-demo="submit-doc-402"]').click();
  await announced(/Insurance certificate, 2026–27 received for review\./);
  assert.deepEqual(await page.evaluate(() => window.uploads.at(-1)), {
    requestId: "DOC-402",
    file: { name: "insurance-2026-27.pdf", size: 120000, isFile: true },
    hasAttachment: false,
  });
  assert.match(await txt(row("doc-402")), /Received insurance-2026-27\.pdf/);

  // Keyboard: rows are disclosure buttons.
  const r403 = row("doc-403");
  assert.equal(await r403.getAttribute("aria-expanded"), "true");
  await r403.focus();
  await page.keyboard.press("Enter");
  assert.equal(await r403.getAttribute("aria-expanded"), "false");
  await page.keyboard.press("Space");
  assert.equal(await r403.getAttribute("aria-expanded"), "true");
  assert.match(await txt(root), /DOC-403 · Avery Kim · PDF, DOCX · up to 10\.0 MB/);

  // Drop is an enhancement on the same validation.
  const dropZone = page.getByRole("button", { name: "Choose file" }).locator("..");
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(["memorandum"], "rent-review-2024.docx"));
    return data;
  });
  await dropZone.dispatchEvent("drop", { dataTransfer: transfer });
  await page.locator('[data-demo="submit-doc-403"]').click();
  await announced(/Rent review memorandum, 2024 received for review\./);
  await header.filter({ hasText: /All in/ }).waitFor();
  assert.match(await txt(header), /5 of 5/);
  await tray.filter({ hasText: "Everything requested is in." }).waitFor();

  // Overdue, invalid file rules and an empty checklist.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.DocumentRequests referenceDate="2026-10-17" requests={[{id:'R1',title:'Board minutes',description:'Signed minutes.',requestedBy:'Avery Kim',dueLabel:'14 October',due:'2026-10-14',state:'awaiting',allowedExtensions:[],maxBytes:0,suggestion:{id:'i1',name:'minutes.pdf',bytes:100,from:'Ada',receivedLabel:'today'}}]}/>);`);
  const r1 = page.locator('[data-demo="request-r1"]');
  assert.match(await txt(r1), /3 days overdue/);
  assert.match(await txt(page.getByRole("region")), /R1 · Avery Kim · File rules missing/);
  assert.equal(await page.getByRole("button", { name: "Choose file" }).isDisabled(), true);
  await page.locator('[data-demo="attach-r1"]').click();
  await page.getByRole("alert").filter({ hasText: "This request has invalid file rules. Ask the requester to fix them." }).waitFor();

  await mount(`createRoot(document.getElementById('root')).render(<Subject.DocumentRequests requests={[]}/>);`);
  await page.getByText("Nothing has been requested yet.").waitFor();
  assert.match(await txt(page.getByRole("complementary", { name: "Received documents" })), /Files you send appear here/);
  assert.doesNotMatch(await txt(page.getByRole("region")), /Everything requested is in/);
}
