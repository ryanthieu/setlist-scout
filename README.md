# Setlist Scout

A Chrome extension that overlays setlist intelligence onto ticket purchase
pages: when you're looking at an event page for an artist, it tells you what
they've actually been playing on this tour.

## Setup

```bash
pnpm install
```

### Extension

```bash
pnpm --filter @setlist-scout/extension dev    # HMR dev build
pnpm --filter @setlist-scout/extension build   # writes apps/extension/dist
```

Load unpacked in Chrome: `chrome://extensions` → enable Developer Mode →
Load unpacked → select `apps/extension/dist`.

Visit a real Ticketmaster (`ticketmaster.com/*/event/*`) or Dice
(`dice.fm/event/*`) event page for a touring artist — a small pill appears
bottom-right; click it to expand the panel showing locks, rotating songs,
bustouts, and set stats. Confirmed working end to end against real pages:
detection, the background fetch bridge, and the panel itself.

**Options:** right-click the extension icon → Options (or
`chrome://extensions` → Setlist Scout → Extension options) to toggle
auto-expand and spoiler-free mode. Settings are stored in
`chrome.storage.local` and persist across browser restarts.

**Second site:** dice.fm event pages work the same way as Ticketmaster's —
same content script, same panel. Bandsintown was the other candidate but
403s automated fetches, so it wasn't usable for building a fixture.

**Bustouts:** songs that reappear in the current tour after a 2+ year gap
show up in their own highlighted section in the panel. Computing them
means a second, wider setlist.fm fetch (3 years back), so they're cached
separately from the main aggregate (7-day freshness) and may take a
moment to appear on an artist's first request.

**Screenshots:** not included — grab your own from a loaded extension on
a real page if you need them for a store listing.

**Production build:** `pnpm --filter @setlist-scout/extension build`
produces a manifest with `host_permissions` scoped to just the deployed
worker URL (no wildcard, no leftover localhost). Package it for upload
with `pnpm --filter @setlist-scout/extension package`, which zips
whatever is actually in `dist/` into
`apps/extension/setlist-scout-v<version>.zip`.

### Worker

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # fill in SETLISTFM_API_KEY
pnpm dev:worker
```

Serves locally, e.g. `curl http://localhost:8787/health` or
`curl 'http://localhost:8787/aggregate?artist=Phish'`.

Deploying requires a real KV namespace and a Cloudflare login:

```bash
npx wrangler login                        # from apps/worker
npx wrangler kv namespace create CACHE    # paste the resulting id into wrangler.toml
npx wrangler secret put SETLISTFM_API_KEY
npx wrangler deploy
```

**Deployed:** `https://setlist-scout-worker.ryanthieu1.workers.dev` (free
`*.workers.dev` subdomain, no custom domain). Verified live — `/health`
and a real `/aggregate?artist=Phish` call both return correct data. The
extension's production build (`apps/extension/src/lib/worker-url.ts`) and
manifest `host_permissions` both point at this URL.

### `/aggregate` behavior

- `GET /aggregate?artist=<name>` or `GET /aggregate?mbid=<mbid>` (the
  latter skips MusicBrainz resolution).
- A response includes `cached: true` when served from KV without calling
  upstream, and additionally `stale: true` when it's a cached copy served
  because a live upstream call failed.
- CORS is restricted to `chrome-extension://*` origins plus
  `localhost`/`127.0.0.1` for local extension dev.
- Per-IP requests are throttled to 30/minute (KV-backed, best-effort, not
  exact under concurrent load — see `src/throttle.ts`).

## setlist.fm API terms

Source: https://www.setlist.fm/help/api-terms (via api.setlist.fm/docs
overview page).

- **Non-commercial only.** The API key is granted for non-commercial use;
  "if the primary purpose of your application is to derive revenue, it is
  considered commercial." This extension is free with no ads or paid tier,
  so it should qualify as non-commercial, but that hasn't been confirmed
  directly with setlist.fm. If monetization is ever considered, contact
  them first.
- **Attribution is required** wherever setlist.fm data is displayed — a
  visible link to the relevant setlist.fm page or the homepage, without a
  `nofollow` attribute. The panel's footer link fulfills this; it links to
  the artist's setlist.fm page (the `sourceUrl` field on
  `ArtistAggregate`), not just the homepage.
- **Caching is restricted to "short periods."** The terms say data must be
  fetched with direct server calls and distributed to end users
  "immediately upon receipt," with only short-period caching allowed. This
  is in tension with the actual design here (24h TTL on aggregates, 30-day
  TTL on name→MBID mappings). **Deliberate decision, not a re-reading of
  the terms:** keeping the 24h/30-day TTLs. Reasoning: this is a free,
  non-commercial, low-traffic personal project, not a service reselling or
  mirroring setlist.fm's data — setlist data for a given artist typically
  doesn't change more than once a day (a new show gets logged, at most,
  once daily per artist), so a 24h aggregate cache doesn't meaningfully
  diverge from "immediately upon receipt" in practice, and a 30-day cache
  on a name→MBID mapping that almost never changes at all isn't the kind
  of thing these terms seem aimed at. This is a judgment call, not a legal
  opinion — if this project ever gets real traffic or attention, it's
  still worth actually asking setlist.fm rather than leaning on this
  reasoning indefinitely.
- **Rate limits**: checked with a real API key. setlist.fm's responses
  don't carry a numeric rate-limit header (just `cache-control:
  no-transform, max-age=60`), and the published terms don't state a
  requests/sec number for API keys either. The worker treats ~1 req/sec as
  a conservative working assumption (sequential awaits, no parallel
  setlist.fm calls per request). Worth confirming a real number from the
  developer dashboard if this ever needs to scale.
- **MusicBrainz rate limits** (not covered by setlist.fm's terms, but the
  worker calls both): confirmed via response headers —
  `x-ratelimit-limit: 1200` with a rolling window, enforced per the
  `x-ratelimit-zone`. Requests without a descriptive `User-Agent` are
  rejected outright; a burst of unauthenticated requests in quick
  succession returned `503 { "error": "...currently busy..." }` even
  under the documented limit, so treat ~1 req/sec as a practical ceiling
  regardless of what the header allows.
- Web Store distribution itself isn't explicitly prohibited by these terms
  as long as the non-commercial condition holds.
