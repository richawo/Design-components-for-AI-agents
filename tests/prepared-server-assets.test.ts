import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { copyPreparedServerAssets } from "../scripts/lib/prepared-server-assets.mjs";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
const fixture = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "prepared-server-assets-"));
  directories.push(directory);
  const preparedDirectory = path.join(directory, "prepared"), destination = path.join(directory, "lazy");
  fs.mkdirSync(path.join(preparedDirectory, "cloudflare"), { recursive: true });
  fs.mkdirSync(destination);
  const sharedManifest = path.join(directory, "router-manifest.sql");
  fs.writeFileSync(sharedManifest, "SELECT 'router cache';");
  fs.writeFileSync(path.join(preparedDirectory, "cloudflare/cache-assets-manifest.sql"), "SELECT 'router cache';");
  fs.writeFileSync(path.join(preparedDirectory, "needed.wasm"), "kept");
  fs.writeFileSync(path.join(preparedDirectory, "server-entry.js"), "export default {};");
  return { preparedDirectory, destination, sharedManifest, serverEntry: "server-entry.js", serverSource: "export default {};" };
};

describe("prepared server modules", () => {
  it("omits the unused identical router manifest while keeping other assets", () => {
    const input = fixture();
    expect(copyPreparedServerAssets(input).omittedManifest).toBe(true);
    expect(fs.existsSync(path.join(input.destination, "cloudflare/cache-assets-manifest.sql"))).toBe(false);
    expect(fs.readFileSync(path.join(input.destination, "needed.wasm"), "utf8")).toBe("kept");
    expect(fs.existsSync(path.join(input.destination, "server-entry.js"))).toBe(false);
  });

  it("keeps a manifest referenced by the lazy server", () => {
    const input = fixture();
    input.serverSource = 'import manifest from "./cloudflare/cache-assets-manifest.sql";';
    expect(copyPreparedServerAssets(input).omittedManifest).toBe(false);
    expect(fs.existsSync(path.join(input.destination, "cloudflare/cache-assets-manifest.sql"))).toBe(true);
  });

  it("keeps different manifest contents and works without a shared router file", () => {
    const input = fixture();
    fs.writeFileSync(input.sharedManifest, "SELECT 'different';");
    expect(copyPreparedServerAssets(input).omittedManifest).toBe(false);
    fs.unlinkSync(input.sharedManifest);
    expect(copyPreparedServerAssets(input).omittedManifest).toBe(false);
    expect(fs.readFileSync(path.join(input.destination, "cloudflare/cache-assets-manifest.sql"), "utf8")).toBe("SELECT 'router cache';");
  });
});
