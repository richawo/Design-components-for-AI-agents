import fs from "node:fs";
import path from "node:path";

/** Keep referenced or distinct modules; omit only the router's unused, identical manifest copy. */
export function copyPreparedServerAssets({ preparedDirectory, destination, serverEntry, serverSource, sharedManifest }) {
  const duplicate = path.join(preparedDirectory, "cloudflare", "cache-assets-manifest.sql");
  const omitManifest = !serverSource.includes("cache-assets-manifest.sql") &&
    fs.existsSync(duplicate) && fs.existsSync(sharedManifest) &&
    fs.readFileSync(duplicate).equals(fs.readFileSync(sharedManifest));
  const excluded = new Set([serverEntry, `${serverEntry}.map`, "README.md"]);
  for (const name of fs.readdirSync(preparedDirectory).filter(name => !excluded.has(name))) {
    fs.cpSync(path.join(preparedDirectory, name), path.join(destination, name), {
      recursive: true,
      filter: (source) => !omitManifest || path.resolve(source) !== path.resolve(duplicate),
    });
  }
  return { omittedManifest: omitManifest };
}
