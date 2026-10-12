#!/usr/bin/env node
// Isolated browser replay of the real components with controlled host callbacks.
// The fixture and compiled Pro code stay in a local temporary directory.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { build } from "esbuild";
import { launchChromium } from "./lib/browser.mjs";
const root = path.resolve(new URL("..", import.meta.url).pathname),
  flag = (name, dflt) =>
    process.argv
      .find((a) => a.startsWith(`--${name}=`))
      ?.split("=")
      .slice(1)
      .join("=") ?? dflt;
const base = flag("base", "http://127.0.0.1:3189"),
  out = flag("out", "");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-replay-"));
const html = await (
  await fetch(`${base}/preview/block-music-workspace`)
).text();
const styles = [
  ...html.matchAll(/<link[^>]+href="([^"]+\.css(?:\?[^"]*)?)"[^>]*>/g),
].map((m) => new URL(m[1], base).href);
const entry = path.join(tmp, "entry.tsx");
fs.writeFileSync(
  entry,
  `import React from ${JSON.stringify(path.join(root, "node_modules/react/index.js"))};import {createRoot} from ${JSON.stringify(path.join(root, "node_modules/react-dom/client.js"))};
import Music from ${JSON.stringify(path.join(root, "registry/pro/block-music-workspace/block-music-workspace.tsx"))};
import {TeamWorkspace} from ${JSON.stringify(path.join(root, "registry/pro/block-team-workspace/block-team-workspace.tsx"))};
import {MeetingsWorkspace} from ${JSON.stringify(path.join(root, "registry/pro/block-meetings-workspace/block-meetings-workspace.tsx"))};
const mode=location.pathname, fault=new URLSearchParams(location.search).get('fault');
const hostSend=async(body:string)=>{await new Promise(resolve=>setTimeout(resolve,650));if(body.includes('fail'))throw Error('The message could not send. Your draft is still here.');return{id:crypto.randomUUID(),authorId:'sam',body,time:'Now'};};
const app=mode==='/music'?<Music/>:mode==='/team'?<TeamWorkspace onSend={hostSend}/>:<MeetingsWorkspace onJoin={async()=>{await new Promise(resolve=>setTimeout(resolve,300));if(fault==='join')throw Error('The room could not open. Try again.');}} onLeave={()=>{}} onMicrophoneChange={()=>{}} onCameraChange={()=>{}} onHandChange={()=>{}}/>;
createRoot(document.getElementById('root')!).render(app);`,
);
await build({
  entryPoints: [entry],
  outfile: path.join(tmp, "bundle.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  nodePaths: [path.join(root, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
});
const server = http.createServer((req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(fs.readFileSync(path.join(tmp, "bundle.js")));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<html><head>${styles.map((url) => `<link rel="stylesheet" href="${url}">`).join("")}</head><body style="margin:0;background:#050505"><div id="root"></div><script src="/bundle.js"></script></body></html>`,
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await launchChromium({ args: ["--mute-audio"] });
const results = [],
  errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url + "/music");
  await page
    .getByRole("button", { name: "Listen to the edit", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("audio")?.currentTime > 0.25,
    null,
    { timeout: 5000 },
  );
  const audioState = await page
    .locator("audio")
    .evaluate((audio) => ({
      time: audio.currentTime,
      paused: audio.paused,
      muted: audio.muted,
      duration: audio.duration,
      ready: audio.readyState,
      error: audio.error?.message,
      source: !!audio.currentSrc,
    }));
  const time = audioState.time;
  await page.getByRole("tab", { name: "Up next", exact: true }).click();
  await page.waitForTimeout(300);
  const after = await page
    .locator("audio")
    .evaluate((audio) => audio.currentTime);
  results.push({
    case: "player persists across views",
    ok: time > 0 && after > time,
    before: time,
    after,
    audioState,
  });
  await page.getByRole("tab", { name: "Your collection", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Search music", exact: true })
    .fill("Blue hour");
  await page.waitForTimeout(300);
  results.push({
    case: "scoped search filters collection",
    ok:
      (await page
        .getByRole("button", {
          name: "Select Before the city wakes by Iris Field",
          exact: true,
        })
        .count()) === 1 &&
      (await page
        .getByRole("button", {
          name: "Select Paper Lanterns by Mara Vale",
          exact: true,
        })
        .count()) === 0,
  });
  await page.goto(url + "/team");
  const editor = () =>
    page.getByRole("textbox", { name: "Message # studio", exact: true });
  await editor().fill("A draft worth keeping.");
  await page.getByRole("tab", { name: "# product", exact: true }).click();
  await page.getByRole("tab", { name: "# studio", exact: true }).click();
  results.push({
    case: "room draft survives navigation",
    ok: (await editor().innerText()).includes("A draft worth keeping."),
  });
  await editor().fill("Please fail this send.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByRole("alert").waitFor();
  results.push({
    case: "failed send retains draft",
    ok: (await editor().innerText()).includes("Please fail this send."),
  });
  await editor().fill("First message");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await editor().fill("Newer draft");
  await page.waitForTimeout(850);
  results.push({
    case: "late response preserves newer draft",
    ok:
      (await editor().innerText()).includes("Newer draft") &&
      (await page
        .getByRole("log", { name: "Messages" })
        .getByText("First message", { exact: true })
        .count()) === 1,
  });
  await page
    .getByRole("button", {
      name: "Open thread for message by Mara Vale",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Close message thread", exact: true })
    .click();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("data-demo") === "reply-m1",
    null,
    { timeout: 1500 },
  );
  results.push({ case: "thread close restores focus", ok: true });
  await page.goto(url + "/meetings");
  await page.getByRole("tab", { name: "Working notes", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Studio review", exact: true })
    .fill("Keep this decision.");
  await page.getByRole("tab", { name: "Your agenda", exact: true }).click();
  await page.getByRole("tab", { name: "Working notes", exact: true }).click();
  results.push({
    case: "meeting notes survive view switches",
    ok: (
      await page
        .getByRole("textbox", { name: "Studio review", exact: true })
        .innerText()
    ).includes("Keep this decision."),
  });
  await page
    .getByRole("button", { name: "Join selected room", exact: true })
    .click();
  await page.getByRole("button", { name: "Leave room", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Working notes", exact: true }).click();
  results.push({
    case: "room controls persist outside room view",
    ok: await page
      .getByRole("button", { name: "Leave room", exact: true })
      .isVisible(),
  });
  await page.getByRole("button", { name: "Leave room", exact: true }).click();
  await page.getByRole("tab", { name: "Your agenda", exact: true }).waitFor();
  await page.goto(url + "/meetings?fault=join");
  await page
    .getByRole("button", { name: "Join selected room", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  results.push({
    case: "failed join keeps agenda and does not invent a room",
    ok:
      (await page
        .getByRole("tab", { name: "Your agenda", exact: true })
        .getAttribute("aria-selected")) === "true" &&
      (await page
        .getByRole("button", { name: "Leave room", exact: true })
        .count()) === 0,
  });
  const report = {
    summary: {
      ok: results.every((result) => result.ok) && !errors.length,
      observed: { results, errors },
    },
  };
  if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  process.exitCode = report.summary.ok ? 0 : 1;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmp, { recursive: true, force: true });
}
