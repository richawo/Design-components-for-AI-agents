export async function check({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  const settleFocus = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  try {
    await page.setViewportSize({ width: 900, height: 1100 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const join = () => page.getByRole("button", { name: "Join selected room", exact: true });
    const leave = () => page.getByRole("button", { name: "Leave room", exact: true });

    await mount(`window.joinJobs=[];createRoot(document.getElementById('root')).render(<><div data-outside style={{height:72}}>Outside workspace</div><Subject.MeetingsWorkspace onJoin={(id,signal)=>new Promise(resolve=>window.joinJobs.push({id,signal,resolve}))} onLeave={()=>{}}/></>);`);
    await join().click(); await page.waitForFunction(() => window.joinJobs.length === 1);
    await page.locator("[data-outside]").click();
    assert.equal(await page.evaluate(() => document.activeElement === document.body), true);
    await page.evaluate(() => window.joinJobs[0].resolve()); await leave().waitFor(); await settleFocus();
    assert.equal(await page.evaluate(() => document.activeElement === document.body), true, "A delayed join preserves the newer outside click");
    await capture("outside-host-during-join", { audit: true });

    await mount(`window.joinJobs=[];createRoot(document.getElementById('root')).render(<Subject.MeetingsWorkspace onJoin={(id,signal)=>new Promise(resolve=>window.joinJobs.push({id,signal,resolve}))} onLeave={()=>{}}/>);`);
    await join().focus(); await join().press("Enter"); await page.waitForFunction(() => window.joinJobs.length === 1);
    await page.evaluate(() => window.joinJobs[0].resolve()); await leave().waitFor();
    await page.waitForFunction(() => document.activeElement?.dataset.demo === "nav-room");
    await capture("owned-join-focus", { audit: true });

    await mount(`window.leaveJobs=[];createRoot(document.getElementById('root')).render(<><div data-outside style={{height:72}}>Outside workspace</div><Subject.MeetingsWorkspace onJoin={async()=>{}} onLeave={(id,signal)=>new Promise(resolve=>window.leaveJobs.push({id,signal,resolve}))}/></>);`);
    await join().click(); await leave().waitFor(); await settleFocus();
    await leave().click(); await page.waitForFunction(() => window.leaveJobs.length === 1);
    await page.locator("[data-outside]").click();
    assert.equal(await page.evaluate(() => document.activeElement === document.body), true);
    await page.evaluate(() => window.leaveJobs[0].resolve()); await join().waitFor(); await settleFocus();
    assert.equal(await page.evaluate(() => document.activeElement === document.body), true, "A delayed leave preserves the newer outside click");
    await capture("outside-host-during-leave", { audit: true });

    await mount(`window.joinJobs=[];createRoot(document.getElementById('root')).render(<><button type="button" data-outside>Continue elsewhere</button><Subject.MeetingsWorkspace onJoin={(id,signal)=>new Promise(resolve=>window.joinJobs.push({id,signal,resolve}))} onLeave={()=>{}}/></>);`);
    await join().click(); await page.waitForFunction(() => window.joinJobs.length === 1);
    const outside = page.getByRole("button", { name: "Continue elsewhere", exact: true });
    await outside.click(); await page.evaluate(() => window.joinJobs[0].resolve()); await leave().waitFor(); await settleFocus();
    assert.equal(await outside.evaluate(node => document.activeElement === node), true, "The host's focused action retains focus");
    await capture("outside-host-action", { audit: true });
  } finally {
    if (viewport) await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
}
