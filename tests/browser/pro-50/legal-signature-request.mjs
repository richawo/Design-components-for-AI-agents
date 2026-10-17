const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
const SIGNERS = {
  maya: { id: "maya", name: "Maya Okafor", email: "maya.okafor@fieldnote.co.uk", title: "Chief Executive", party: "Fieldnote Ltd" },
  jordan: { id: "jordan", name: "Jordan Blake", email: "jordan.blake@harbourworks.com", title: "General Counsel", party: "Harbour Works Ltd" },
  priya: { id: "priya", name: "Priya Raman", email: "priya.raman@harbourworks.com", title: "Chief Financial Officer", party: "Harbour Works Ltd" },
};

export async function check({ page, mount, assert }) {
  await mount(`window.drafts=[];window.fail=true;function Host(){const [progress,setProgress]=useState(undefined);window.setProgress=setProgress;return <Subject.SignatureRequest referenceDate="2026-10-17" progress={progress} onSend={async d=>{window.drafts.push(d);if(window.fail)throw Error('offline')}}/>;}createRoot(document.getElementById('root')).render(<Host/>);`);
  const root = page.getByRole("region", { name: "Signature request, Master Services Agreement" });
  const header = root.locator("header").first();
  const sheet = page.getByRole("article", { name: "Master Services Agreement, execution page" });
  const route = page.getByRole("list", { name: "Signers in signing order" });
  const send = page.locator('[data-demo="send"]');
  const announced = (re) => page.getByRole("status").filter({ hasText: re }).waitFor();

  assert.match(await txt(header), /Not sent Draft · 3 signers/);
  assert.match(await txt(sheet), /Page 14 of 14/i);
  assert.match(await txt(sheet), /18\.1 This Agreement may be executed in any number of counterparts/);
  assert.match(await sheet.textContent(), /Signature, date and initials for Maya Okafor, signing 1/);
  assert.match(await sheet.textContent(), /Signature, date and initials for Jordan Blake, signing 2/);
  assert.match(await txt(root), /Maya receives it first\./);
  assert.match(await txt(root), /Lapses on 31 Oct 2026/);

  // Signature interaction: reorder the route by keyboard; the tags on the page renumber.
  await page.getByRole("button", { name: "Move Maya Okafor earlier" }).isDisabled().then((d) => assert.equal(d, true));
  await page.getByRole("button", { name: "Move Maya Okafor later" }).focus();
  await page.keyboard.press("Enter");
  await announced(/Maya Okafor now signs 2nd\./);
  assert.deepEqual(
    (await route.getByRole("listitem").allInnerTexts()).map((t) => t.match(/Maya Okafor|Jordan Blake|Priya Raman/)[0]),
    ["Jordan Blake", "Maya Okafor", "Priya Raman"],
  );
  assert.match(await sheet.textContent(), /Signature, date and initials for Jordan Blake, signing 1/);
  assert.match(await sheet.textContent(), /Signature, date and initials for Maya Okafor, signing 2/);
  assert.match(await txt(root), /Jordan receives it first\./);
  await page.getByRole("button", { name: "Move Priya Raman earlier" }).click();
  await announced(/Priya Raman now signs 2nd\./);
  await page.getByRole("button", { name: "Move Priya Raman later" }).click();
  await announced(/Priya Raman now signs 3rd\./);
  assert.equal(await page.getByRole("button", { name: "Move Priya Raman later" }).isDisabled(), true);

  // All at once numbers every step 1; switching back restores the order.
  await page.getByRole("radio", { name: "All at once" }).click();
  await announced(/Everyone signs at once\./);
  assert.match(await sheet.textContent(), /Maya Okafor, signing 1/);
  assert.match(await sheet.textContent(), /Priya Raman, signing 1/);
  assert.match(await txt(root), /Everyone receives it at once\./);
  await page.getByRole("radio", { name: "In order" }).click();
  await page.getByRole("radio", { name: "In order", checked: true }).waitFor();

  // Expiry and message.
  await page.getByRole("radio", { name: "30 days" }).click();
  assert.match(await txt(root), /Lapses on 16 Nov 2026/);
  const message = page.getByLabel("Message to signers", { exact: true });
  await message.fill("  v3.2 with the agreed liability cap. Please sign this week.  ");

  // The provider rejects first: order and message are kept.
  await send.click();
  await page.getByRole("alert").filter({ hasText: "Couldn’t reach the signing service. Nothing was sent." }).waitFor();
  await announced(/The request wasn’t sent\. Your signing order and message are kept\./);
  assert.match(await txt(send), /Try again/);
  assert.equal(await message.inputValue(), "  v3.2 with the agreed liability cap. Please sign this week.  ");
  assert.match(await txt(route.getByRole("listitem").first()), /Jordan Blake/);
  assert.match(await txt(header), /Not sent/);

  await page.evaluate(() => (window.fail = false));
  await send.click();
  await announced(/Sent for signature\. It’s with Jordan Blake now\./);
  assert.equal(await page.evaluate(() => window.drafts.length), 2);
  assert.deepEqual(await page.evaluate(() => window.drafts[1]), {
    documentId: "doc-msa-114",
    version: "3.2",
    mode: "sequential",
    signers: [
      { ...SIGNERS.jordan, order: 1 },
      { ...SIGNERS.maya, order: 2 },
      { ...SIGNERS.priya, order: 3 },
    ],
    message: "v3.2 with the agreed liability cap. Please sign this week.",
    expiresOn: "2026-11-16",
  });

  // The route becomes a tracker; nothing is signed until the provider says so.
  const progress = page.getByRole("complementary", { name: "Signing progress" });
  await progress.filter({ hasText: "With Jordan now" }).waitFor();
  assert.match(await txt(header), /0 of 3 signed Expires 16 Nov/);
  assert.match(await txt(progress), /Waiting for Jordan Blake/);
  assert.doesNotMatch(await sheet.textContent(), /Signed by/);

  await page.evaluate(() => window.setProgress([{ signerId: "jordan", state: "viewed", at: "2026-10-17T10:34:00Z" }]));
  await progress.filter({ hasText: "Viewed 17 Oct, 10:34" }).waitFor();
  await page.evaluate(() => window.setProgress([{ signerId: "jordan", state: "signed", at: "2026-10-17T10:42:00Z" }]));
  await announced(/^Jordan Blake signed\.$/);
  await header.filter({ hasText: /1 of 3 signed/ }).waitFor();
  await progress.filter({ hasText: "Signed 17 Oct, 10:42" }).waitFor();
  await progress.filter({ hasText: "Waiting for Maya Okafor" }).waitFor();
  assert.match(await txt(progress), /With Maya now/);
  assert.match(await sheet.textContent(), /Signed by Jordan Blake/);
  assert.doesNotMatch(await sheet.textContent(), /Signed by Maya Okafor/);

  await page.evaluate(() =>
    window.setProgress([
      { signerId: "jordan", state: "signed", at: "2026-10-17T10:42:00Z" },
      { signerId: "maya", state: "signed", at: "2026-10-18T09:00:00Z" },
      { signerId: "priya", state: "signed", at: "2026-10-19T16:05:00Z" },
    ]),
  );
  await announced(/Maya Okafor and Priya Raman signed\./);
  await header.filter({ hasText: /3 of 3 signed\s*Fully executed/ }).waitFor();
  // The stamp carries the last signature's date; each block shows its own date.
  assert.match(await txt(sheet), /Executed 19 Oct 2026/i);
  assert.match(await txt(sheet), /Jordan Blake General Counsel 17\/10\/26/);
  assert.match(await txt(sheet), /Initials MO JB PR/i);
  await progress.filter({ hasText: "Every party has signed." }).waitFor();

  // A decline is reported as such.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SignatureRequest referenceDate="2026-10-17" progress={[{signerId:'maya',state:'signed'},{signerId:'jordan',state:'declined'}]}/>);`);
  const declined = page.getByRole("region", { name: /Signature request/ });
  assert.match(await txt(declined.locator("header").first()), /1 of 3 signed Declined by Jordan Blake/);
  await page.getByRole("complementary", { name: "Signing progress" }).filter({ hasText: "Jordan Blake declined to sign." }).waitFor();

  // Invalid and duplicate signers block sending.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SignatureRequest referenceDate="2026-10-17" signers={[{id:'a',name:'Ada Park',email:'ada@fieldnote.co.uk',title:'CEO',party:'Fieldnote'},{id:'b',name:'Ben Ito',email:'ADA@fieldnote.co.uk ',title:'GC',party:'Harbour'},{id:'c',name:'  ',email:'c@harbour.com',title:'CFO',party:'Harbour'},{id:'d',name:'Dee Hart',email:'dee@',title:'COO',party:'Harbour'}]}/>);`);
  const bad = page.getByRole("list", { name: "Signers in signing order" });
  assert.match(await txt(bad), /Same email as another signer/);
  assert.match(await txt(bad), /Name missing/);
  assert.match(await txt(bad), /Email address isn’t valid/);
  assert.match(await txt(page.getByRole("region")), /Fix 4 signers before sending\./);
  assert.equal(await page.locator('[data-demo="send"]').isDisabled(), true);

  // No signers.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SignatureRequest signers={[]}/>);`);
  await page.getByText("Add the people signing for each party to route this agreement.").waitFor();
  await page.getByText("Signature blocks appear here once signers are added.").waitFor();
  assert.equal(await page.locator('[data-demo="send"]').isDisabled(), true);
}
