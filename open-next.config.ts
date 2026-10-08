import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page is prerendered at build time and nothing revalidates, so the
// default (no incremental cache) is all the site needs.
export default defineCloudflareConfig();
