import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "Setlist Scout",
  version: pkg.version,
  description:
    "Shows what an artist has actually been playing on tour, right on the ticket page.",
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
});
