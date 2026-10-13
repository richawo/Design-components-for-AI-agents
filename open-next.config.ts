import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Publish the build-time HTML/RSC cache with the Worker assets. A dummy cache
// makes even prerendered catalogue pages render again for each route request.
// Only prerendered public routes are intercepted; account and licensed-source
// requests continue through the dynamic server and its authorization checks.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
