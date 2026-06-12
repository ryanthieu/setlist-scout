import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

// Vite sets this to "production" for `vite build`, "development" for `vite`
// (dev server). localhost has no business shipping in a production
// permissions audit -- see host_permissions below.
const isProduction = process.env.NODE_ENV === "production";

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
      matches: [
        "https://www.ticketmaster.com/*/event/*",
        "https://dice.fm/event/*",
      ],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage"],
  // localhost is a dev-only convenience for talking to `wrangler dev` --
  // it has no purpose in a shipped build and would just be a confusing,
  // unjustifiable line item in a store permissions review. Production
  // grants exactly the one real worker URL, nothing wider.
  host_permissions: isProduction
    ? ["https://setlist-scout-worker.ryanthieu1.workers.dev/*"]
    : ["http://localhost:8787/*"],
});
