import { execFile } from "node:child_process";
import { createServer } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const exec = promisify(execFile);
const cli = path.resolve("packages/cli/index.mjs");
const entries = [
  {
    slug: "fixture-chart",
    tier: "free",
    platform: "web",
    dependencies: [],
    name: "Fixture chart",
  },
  {
    slug: "fixture-table",
    tier: "pro",
    platform: "web",
    dependencies: [],
    name: "Fixture table",
  },
  {
    slug: "fixture-page",
    tier: "pro",
    platform: "web",
    kind: "block",
    components: ["fixture-chart", "fixture-table"],
    dependencies: [],
    name: "Fixture page",
  },
];

async function withRegistry(
  licensed: boolean,
  check: (root: string, base: string, requests: string[]) => Promise<void>,
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dfa-block-install-"));
  const requests: string[] = [];
  const server = createServer((req, res) => {
    const slug = req.url?.split("/").at(-1)?.split("?")[0];
    if (req.url === "/api/registry") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ components: entries }));
      return;
    }
    requests.push(slug!);
    if (slug === "fixture-table" && !licensed) {
      res.writeHead(401);
      res.end("{}");
      return;
    }
    res.setHeader("Content-Type", "text/plain");
    res.end(
      slug === "fixture-page"
        ? 'import { Chart } from "./fixture-chart"; import { Table } from "./fixture-table"; export const Page = () => [Chart, Table];'
        : `export const ${slug === "fixture-chart" ? "Chart" : "Table"} = () => null;`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  try {
    await check(root, `http://127.0.0.1:${address.port}`, requests);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

it("fetches a block's protected composition before writing coherent sibling imports", async () => {
  await withRegistry(true, async (root, base, requests) => {
    await exec(
      process.execPath,
      [cli, "add", "fixture-page", "fixture-table", "--no-install"],
      {
        cwd: root,
        env: {
          ...process.env,
          DESIGN_FOR_AI_URL: base,
          XDG_CONFIG_HOME: path.join(root, "config"),
        },
      },
    );
    expect(requests).toEqual([
      "fixture-chart",
      "fixture-table",
      "fixture-page",
    ]);
    const folder = path.join(root, "components/design-for-ai");
    expect(fs.readdirSync(folder).sort()).toEqual([
      "fixture-chart.tsx",
      "fixture-page.tsx",
      "fixture-table.tsx",
    ]);
    expect(
      fs.readFileSync(path.join(folder, "fixture-page.tsx"), "utf8"),
    ).toContain('from "./fixture-table"');
  });
});

it("leaves the project untouched when a dependency licence check fails", async () => {
  await withRegistry(false, async (root, base) => {
    await expect(
      exec(process.execPath, [cli, "add", "fixture-page", "--no-install"], {
        cwd: root,
        env: {
          ...process.env,
          DESIGN_FOR_AI_URL: base,
          XDG_CONFIG_HOME: path.join(root, "config"),
        },
      }),
    ).rejects.toMatchObject({ code: 1 });
    expect(fs.existsSync(path.join(root, "components"))).toBe(false);
  });
});
