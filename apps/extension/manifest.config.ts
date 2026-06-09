import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "Setlist Scout",
  version: pkg.version,
  description:
    "Shows what an artist has actually been playing on tour, right on the ticket page.",
  icons: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  options_page: "src/options/index.html",
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://www.ticketmaster.com/*/event/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage"],
  // localhost only for now -- the worker isn't deployed yet (see DEVLOG
  // Phase 2). Add the real *.workers.dev URL here once it is; don't widen
  // this to a wildcard host permission in the meantime.
  host_permissions: ["http://localhost:8787/*"],
});
