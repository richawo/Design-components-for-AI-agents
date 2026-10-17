export async function check({ page, mount, assert }) {
  const file = { id: "agreement", name: "Agreement.pdf", kind: "PDF", sizeBytes: 2048, pages: 3, modified: "Today" };
  const props = `file={${JSON.stringify(file)}} renderPage={(index,width)=><div style={{height:width*1.414}}>Agreement page {index+1}</div>}`;
  await mount(`window.downloads=[];window.opened=[];window.shared=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MobileFilePreview ${props} onDownload={async(f,report)=>{window.downloads.push(f.id);report(0.5);if(window.fail)throw Error('Connection dropped.');await new Promise(resolve=>window.finishDownload=resolve)}} onOpen={f=>window.opened.push(f.id)} onShare={f=>window.shared.push(f.id)}/>);`);
  const pagesRegion = page.getByRole("region", { name: "Document pages", exact: true });
  assert.equal(await pagesRegion.getAttribute("tabindex"), "0");
  const scrubber = page.getByRole("slider", { name: /^Page \d of 3$/ });
  await scrubber.focus();
  await page.keyboard.press("End");
  await page.getByRole("slider", { name: "Page 3 of 3", exact: true }).waitFor();
  assert.equal(await scrubber.getAttribute("aria-valuenow"), "3");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.getByRole("slider", { name: "Page 2 of 3", exact: true }).waitFor();
  await page.getByRole("button", { name: "Share", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.shared), ["agreement"]);
  await page.locator('[data-demo="file-download"]').press("Enter");
  await page.getByText("Connection dropped.", { exact: true }).waitFor();
  await page.getByRole("slider", { name: "Page 2 of 3", exact: true }).waitFor();
  await page.evaluate(() => window.fail = false);
  await page.getByRole("button", { name: "Try download again", exact: true }).press("Enter");
  assert.equal(await page.locator('[data-demo="file-download"]').isDisabled(), true);
  await page.evaluate(() => window.finishDownload());
  await page.getByRole("button", { name: "Saved to Files", exact: true }).waitFor();
  await page.getByRole("button", { name: "Saved to Files", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.downloads), ["agreement", "agreement"]);
  assert.deepEqual(await page.evaluate(() => window.opened), ["agreement"]);
  await mount(`window.retries=[];createRoot(document.getElementById('root')).render(<Subject.MobileFilePreview ${props} status="error" onRetry={f=>window.retries.push(f.id)}/>);`);
  await page.getByRole("button", { name: "Try again", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.retries), ["agreement"]);
  for (const pages of ["0", "-1", "1.5", "NaN", "Infinity"]) {
    await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileFilePreview file={{...${JSON.stringify(file)},pages:${pages}}}/>);`);
    await page.getByText("No pages are available for this file.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("slider").count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|Page 1 of 0/);
  }
}
