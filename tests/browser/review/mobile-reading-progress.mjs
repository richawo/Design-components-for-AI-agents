export async function check({ page, mount, assert }) {
  const book = { id: "water", title: "Quiet Water", author: "Ilse Marchetti", pages: 60 };
  const chapters = [
    { id: "start", title: "Departure", startPage: 1 },
    { id: "middle", title: "Across the bay", startPage: 16 },
    { id: "finish", title: "Landfall", startPage: 31 },
  ];
  const props = `book={${JSON.stringify(book)}} chapters={${JSON.stringify(chapters)}} currentPage={20} defaultBookmarks={[]}`;
  await mount(
    `window.calls=[];window.signals=[];window.bookmarks=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MobileReadingProgress ${props} onBookmarksChange={items=>window.bookmarks.push(items)} onResume={async(p,signal)=>{window.calls.push(p);window.signals.push(signal);if(window.fail)throw Error('Reader unavailable');await new Promise(resolve=>window.finishResume=resolve)}}/>);`,
  );
  const edge = page.locator('[data-demo="reading-edge"]');
  const strip = await edge.boundingBox();
  assert.ok(strip);
  await page.mouse.move(strip.x + strip.width * 0.25, strip.y + strip.height / 2);
  await page.mouse.down();
  await page.mouse.move(strip.x + strip.width * 0.8, strip.y + strip.height / 2, { steps: 12 });
  await page.mouse.up();
  assert.equal(await edge.getAttribute("aria-valuenow"), "48", "The page edge supports a real drag");
  await edge.press("Home");
  assert.equal(await edge.getAttribute("aria-valuenow"), "1");
  await edge.press("ArrowLeft");
  assert.equal(await edge.getAttribute("aria-valuenow"), "1");
  await edge.press("End");
  assert.equal(await edge.getAttribute("aria-valuenow"), "60");
  await edge.press("ArrowRight");
  assert.equal(await edge.getAttribute("aria-valuenow"), "60");
  await page.locator('[data-demo="reading-chapter-finish"]').press("Enter");
  await edge.press("ArrowRight");
  assert.equal(await edge.getAttribute("aria-valuenow"), "41");
  await page.getByRole("button", { name: "Bookmark this page", exact: true }).press("Enter");
  await page.waitForFunction(() => window.bookmarks.length === 1);
  assert.deepEqual(await page.evaluate(() => window.bookmarks[0].map((b) => b.page)), [41]);
  await page.locator('[data-demo="reading-tab-bookmarks"]').press("Space");
  assert.equal(await page.locator('[data-demo="reading-tab-bookmarks"]').getAttribute("aria-selected"), "true");
  await page.locator('[data-demo="reading-tab-bookmarks"]').press("Home");
  assert.equal(
    await page.locator('[data-demo="reading-tab-chapters"]').evaluate((el) => el === document.activeElement),
    true,
  );
  await page.locator('[data-demo="reading-tab-chapters"]').press("ArrowRight");
  await page.getByRole("button", { name: /^Bookmark, page 41/ }).waitFor();
  await page.locator('[data-demo="reading-resume"]').press("Enter");
  await page.getByText("Couldn’t open. Try again", { exact: true }).waitFor();
  assert.equal(await edge.getAttribute("aria-valuenow"), "41");
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="reading-resume"]').press("Enter");
  await page.getByRole("button", { name: "Opening. Tap to cancel", exact: true }).press("Enter");
  assert.equal(await page.evaluate(() => window.signals[1].aborted), true);
  await page.evaluate(() => window.finishResume());
  assert.equal(await page.getByText("Opened", { exact: true }).count(), 0);
  await page.locator('[data-demo="reading-resume"]').press("Enter");
  await page.getByRole("button", { name: "Opening. Tap to cancel", exact: true }).waitFor();
  await page.evaluate(() => window.finishResume());
  await page.getByText("Opened", { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.calls[2]), { bookId: "water", chapterId: "finish", page: 41 });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileReadingProgress ${props} defaultTab="bookmarks"/>);`,
  );
  await page.getByText("No bookmarks yet", { exact: true }).waitFor();
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileReadingProgress ${props}/>);`);
  assert.equal(
    await page.locator('[data-demo="reading-resume"]').isDisabled(),
    true,
    "An unavailable reader cannot acknowledge an opening",
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileReadingProgress book={${JSON.stringify(book)}} chapters={[]} defaultBookmarks={[]} onResume={()=>{}}/>);`,
  );
  await page.getByText("No chapters available", { exact: true }).waitFor();
  await page.getByText("Chapters unavailable", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-demo="reading-resume"]').isDisabled(), true);
  await mount(
    `window.oldSignal=null;function Host(){const [selected,setSelected]=useState(${JSON.stringify(book)});window.changeBook=()=>setSelected({...selected,id:'next-book',title:'The Next Crossing'});window.repaginate=()=>setSelected({...selected,pages:30});return <Subject.MobileReadingProgress book={selected} chapters={${JSON.stringify(chapters)}} currentPage={20} defaultBookmarks={[]} onResume={(destination,signal)=>new Promise(resolve=>{window.oldSignal=signal;window.finishOld=resolve})}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.locator('[data-demo="reading-chapter-finish"]').press("Enter");
  await page.locator('[data-demo="reading-edge"]').press("ArrowRight");
  await page.locator('[data-demo="reading-resume"]').press("Enter");
  await page.getByRole("button", { name: "Opening. Tap to cancel", exact: true }).waitFor();
  await page.evaluate(() => window.repaginate());
  await page.waitForFunction(
    () =>
      document.querySelector('[data-demo="reading-edge"]').getAttribute("aria-valuemax") === "30" &&
      document.querySelector('[data-demo="reading-edge"]').getAttribute("aria-valuenow") === "30",
  );
  assert.equal(await page.evaluate(() => window.oldSignal.aborted), true);
  await page.evaluate(() => window.finishOld());
  assert.equal(await page.getByText("Opened", { exact: true }).count(), 0);
  await page.locator('[data-demo="reading-resume"]').press("Enter");
  await page.getByRole("button", { name: "Opening. Tap to cancel", exact: true }).waitFor();
  await page.evaluate(() => window.changeBook());
  await page.getByText("The Next Crossing", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.oldSignal.aborted), true);
  await page.evaluate(() => window.finishOld());
  assert.equal(await page.getByText("Opened", { exact: true }).count(), 0);
  for (const pages of ["NaN", "Infinity", "0", "-2", "1.5"]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.MobileReadingProgress book={{...${JSON.stringify(book)},pages:${pages}}} chapters={[]} defaultBookmarks={[]}/>);`,
    );
    await page.getByText("Page count unavailable", { exact: true }).waitFor();
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
    assert.equal(await page.locator('[data-demo="reading-resume"]').isDisabled(), true);
    assert.equal(await page.getByRole("slider").count(), 0);
  }
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileReadingProgress book={{...${JSON.stringify(book)},pages:Number.MAX_SAFE_INTEGER}} chapters={[{id:'start',title:'Departure',startPage:1},{id:'bad',title:'Invalid chapter',startPage:NaN}]} currentPage={NaN} minutesPerPage={Number.MAX_VALUE} defaultBookmarks={[{id:'bad',page:Infinity}]}/>);`,
  );
  assert.equal(await edge.getAttribute("aria-valuenow"), "1");
  assert.equal(await edge.getAttribute("aria-valuemax"), String(Number.MAX_SAFE_INTEGER));
  assert.equal(await page.getByText("Invalid chapter", { exact: true }).count(), 0);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
}
