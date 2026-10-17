const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
const MSA = "a4c123b1612dd272d1371c17149d439536b3216fdaeeb975729fae923d5a4fd1";
const LOG = "cc3fc1626e53a13043b026c48bbf33feff9243a8f506b40928b5b7a767c76fb0";

export async function check({ page, mount, assert }) {
  await mount(`window.manifests=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.EvidenceIndex onExport={async m=>{window.manifests.push(m);if(window.fail)throw Error('offline')}}/>);`);
  const root = page.getByRole("region", { name: "Trial bundle B, evidence index" });
  const footer = root.locator("footer");
  const custody = page.getByRole("complementary", { name: "Chain of custody" });
  const tab = (label) => page.locator(`[data-demo="tab-${label}"]`);
  const include = (label) => page.getByRole("checkbox", { name: `Include exhibit ${label} in the manifest` });
  const exportButton = page.locator('[data-demo="export"]');

  assert.match(await txt(root.locator("header").first()), /5 of 6 chains intact/);
  // The cover sheet for exhibit A, with the intake hash as the accessible name of the grouped display.
  const sheetA = page.getByRole("article", { name: "Exhibit A: Master services agreement, signed" });
  await sheetA.waitFor();
  await sheetA.getByLabel(MSA, { exact: true }).waitFor();
  assert.match(await txt(sheetA), /Matches at all 4 recorded hand-offs/);
  assert.match(await txt(sheetA), /Bates HWL-000001 – 000042/);
  assert.match(await txt(custody), /Intact/);
  assert.equal(await custody.getByRole("listitem").count(), 4);
  assert.match(await txt(footer), /Manifest · 3 of 6 exhibits/);
  assert.match(await txt(footer), /56 pages · A B E/);
  assert.equal(await include("A").isChecked(), true);
  assert.equal(await include("C").isChecked(), false);

  // Keyboard: open exhibit C, whose re-export no longer matches intake.
  await tab("c").focus();
  await page.keyboard.press("Enter");
  const sheetC = page.getByRole("article", { name: "Exhibit C: Dock 4 delivery log, Q3 2026" });
  await sheetC.waitFor();
  assert.equal(await tab("c").getAttribute("aria-current"), "true");
  assert.equal(await tab("a").getAttribute("aria-current"), null);
  assert.match(await txt(tab("c")), /Chain broken/);
  assert.match(await txt(sheetC), /Hash changed at hand-off 3\. Do not rely on this copy\./);
  await custody.filter({ hasText: "Hash differs from intake. Request the native file or a certified copy." }).waitFor();
  assert.match(await txt(custody), /Broken/);
  assert.equal(await custody.getByRole("listitem").count(), 3);

  // Including a broken exhibit warns before export (keyboard toggles the checkbox).
  await include("C").focus();
  await page.keyboard.press("Space");
  assert.equal(await include("C").isChecked(), true);
  await footer.filter({ hasText: "Exhibit C has a broken chain and will be flagged in the manifest." }).waitFor();
  assert.match(await txt(footer), /Manifest · 4 of 6 exhibits/);
  assert.match(await txt(footer), /57 pages · A B C E/);

  // Export fails first; the selection is kept and the button offers a retry.
  await exportButton.click();
  await page.getByRole("alert").filter({ hasText: "Export failed. Your selection is kept." }).waitFor();
  await page.getByRole("status").filter({ hasText: "wasn’t exported. Your selection is kept" }).waitFor();
  assert.match(await txt(exportButton), /Try again/);
  for (const label of ["A", "B", "C", "E"]) assert.equal(await include(label).isChecked(), true, label);
  assert.match(await txt(footer), /Manifest · 4 of 6 exhibits/);

  await page.evaluate(() => (window.fail = false));
  await exportButton.click();
  await page.getByRole("status").filter({ hasText: "Manifest exported with 4 exhibits." }).waitFor();
  await footer.filter({ hasText: /Exported/ }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
  const manifest = await page.evaluate(() => window.manifests[1]);
  assert.deepEqual(Object.keys(manifest), ["exhibits"]);
  assert.deepEqual(manifest.exhibits.map((e) => e.label), ["A", "B", "C", "E"]);
  assert.deepEqual(manifest.exhibits[0], {
    id: "HWL-EX-01",
    label: "A",
    title: "Master services agreement, signed",
    sha256: MSA,
    bytes: 1842310,
    bates: "HWL-000001 – 000042",
  });
  // The intake hash is what goes out, not the re-exported one.
  assert.deepEqual(manifest.exhibits[2], {
    id: "HWL-EX-03",
    label: "C",
    title: "Dock 4 delivery log, Q3 2026",
    sha256: LOG,
    bytes: 96412,
    bates: "HWL-000046",
  });

  // Changing the selection clears the stamp; an empty manifest can't be exported.
  for (const label of ["A", "B", "C", "E"]) await include(label).uncheck();
  assert.match(await txt(exportButton), /Export manifest/);
  assert.equal(await exportButton.isDisabled(), true);
  assert.match(await txt(footer), /Manifest · 0 of 6 exhibits/);
  assert.match(await txt(footer), /none/);

  // Exhibit F is not yet stamped.
  await tab("f").click();
  const sheetF = page.getByRole("article", { name: /^Exhibit F:/ });
  await sheetF.waitFor();
  assert.match(await txt(sheetF), /Bates Not yet stamped/);

  // Labels fall back to position; empty bundles say so.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.EvidenceIndex defaultIncluded={['x','missing']} exhibits={[{id:'x',title:'Site photo',kind:'Photo',source:'Client',receivedAt:'2026-09-01T10:00:00Z',sha256:'${MSA}',bytes:2048,custody:[{id:'x1',at:'2026-09-01T10:00:00Z',actor:'Avery Kim',action:'Received',sha256:'${MSA.toUpperCase()}'}]},{id:'y',title:'Invoice',kind:'PDF',source:'Client',receivedAt:'2026-09-01T10:00:00Z',sha256:'${LOG}',bytes:1024,custody:[{id:'y1',at:'2026-09-01T10:00:00Z',actor:'Avery Kim',action:'Received'}]}]}/>);`);
  await page.getByRole("article", { name: "Exhibit A: Site photo" }).waitFor();
  assert.equal(await page.locator('[data-demo="tab-b"]').count(), 1);
  // Hash comparison ignores case; an unknown default id is dropped.
  assert.match(await txt(page.getByRole("article")), /Matches at all 1 recorded hand-offs/);
  assert.match(await txt(page.locator("footer")), /Manifest · 1 of 2 exhibits/);

  await mount(`createRoot(document.getElementById('root')).render(<Subject.EvidenceIndex exhibits={[]}/>);`);
  await page.getByText("No exhibits in this bundle yet.").waitFor();

  // Invalid or missing values stay explicit.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.EvidenceIndex exhibits={[{id:'z',title:'Unlogged drive',kind:'Image',source:'Client',receivedAt:'not a date',sha256:'${LOG}',bytes:-1,custody:[]}]}/>);`);
  const bad = page.getByRole("article", { name: "Exhibit A: Unlogged drive" });
  await bad.waitFor();
  assert.match(await txt(bad), /Received Time missing/);
  assert.match(await txt(bad), /Size Size missing/);
  assert.match(await txt(bad), /Pages Not paginated/);
  assert.match(await txt(page.getByRole("complementary", { name: "Chain of custody" })), /No hand-offs recorded yet\./);
  // With no recorded hand-offs nothing was compared, so the sheet must not claim a match.
  assert.doesNotMatch(await txt(bad), /Matches at all 0 recorded hand-offs/);
}
