import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import manifest from "./manifest.config.ts";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    // Explicit, not just relying on the default: a shipped extension
    // shouldn't expose original source via sourcemaps.
    sourcemap: false,
  },
});
