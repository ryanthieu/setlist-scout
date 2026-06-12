/**
 * Deployed 2026-09-02 via `wrangler deploy` (see README). Update this if
 * the worker is ever redeployed under a different name or moved to a
 * custom domain -- and keep manifest.config.ts's production
 * host_permissions in sync with whatever's here.
 */
export const WORKER_URL: string = import.meta.env.DEV
  ? "http://localhost:8787"
  : "https://setlist-scout-worker.ryanthieu1.workers.dev";
