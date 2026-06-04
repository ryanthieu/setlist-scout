# Setlist Scout

A Chrome extension that overlays setlist intelligence onto ticket purchase
pages: when you're looking at an event page for an artist, it tells you what
they've actually been playing on this tour.

See `plan.md` for the full phased implementation plan and `CLAUDE.md` for the
working agreement.

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

### Worker

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # fill in SETLISTFM_API_KEY
pnpm dev:worker
```

Serves locally, e.g. `curl http://localhost:8787/health` or
`curl 'http://localhost:8787/aggregate?artist=Phish'`.

Deploying (Phase 2+) requires a real KV namespace — run
`wrangler kv namespace create CACHE` from `apps/worker` and paste the
resulting id into `wrangler.toml` in place of the placeholder. The worker
deploys to the free `*.workers.dev` subdomain; no custom domain is
configured.

## setlist.fm API terms — read 2026-09-01

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
  `nofollow` attribute. The panel's footer link (Phase 4) fulfills this;
  it should link to the artist's setlist.fm page (the `sourceUrl` field on
  `ArtistAggregate`), not just the homepage.
- **Caching is restricted to "short periods."** The terms say data must be
  fetched with direct server calls and distributed to end users
  "immediately upon receipt," with only short-period caching allowed. This
  is in tension with the plan's Phase 2 design (24h TTL on aggregates,
  30-day TTL on name→MBID mappings). **Unresolved** — needs an explicit
  decision before Phase 2 ships: either shorten the TTLs substantially, or
  make a documented judgment call about what "short periods" means in
  practice for a low-traffic personal project. Don't treat the Phase 1/2
  cache design in the plan as settled.
- **Rate limits**: re-checked in Phase 1 with a real API key. setlist.fm's
  responses don't carry a numeric rate-limit header (just `cache-control:
  no-transform, max-age=60`), and the published terms still don't state a
  requests/sec number for API keys. Went with a conservative ~1 req/sec from
  the worker (sequential awaits, no parallel setlist.fm calls) as a working
  assumption. Needs a real number confirmed from the developer dashboard
  before Phase 2's throttling work claims anything more precise.
- **MusicBrainz rate limits** (not covered by setlist.fm's terms, but the
  worker calls both): confirmed via response headers —
  `x-ratelimit-limit: 1200` with a rolling window, enforced per the
  `x-ratelimit-zone`. Requests without a descriptive `User-Agent` are
  rejected outright; a burst of unauthenticated requests in quick succession
  during fixture-gathering returned `503 { "error": "...currently busy..." }`
  even under the documented limit, so treat ~1 req/sec as a practical ceiling
  regardless of what the header allows.
- Web Store distribution itself isn't explicitly prohibited by these terms
  as long as the non-commercial condition holds.
