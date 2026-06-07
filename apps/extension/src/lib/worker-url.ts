/**
 * The worker hasn't been deployed yet (see DEVLOG Phase 2) -- there is no
 * real production URL to point at. Rather than hardcode a guess and grant
 * a host_permission for it, production intentionally has no target yet:
 * requests will fail with a network error (surfaced as the "error" panel
 * state) until this is filled in after `wrangler deploy` runs for real.
 */
export const WORKER_URL: string = import.meta.env.DEV
  ? "http://localhost:8787"
  : "";
