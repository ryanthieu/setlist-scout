#!/usr/bin/env node
// Zips the production build for Chrome Web Store upload. Run `pnpm build`
// first -- this script doesn't rebuild, so it always zips whatever is
// actually in dist/, avoiding any doubt about a stale/mismatched artifact.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");

if (!existsSync(distDir)) {
  console.error("dist/ not found -- run `pnpm build` first.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const zipPath = resolve(root, `setlist-scout-v${pkg.version}.zip`);

if (existsSync(zipPath)) rmSync(zipPath);

execSync(`zip -rq "${zipPath}" .`, { cwd: distDir });

console.log(`Packaged ${zipPath}`);
