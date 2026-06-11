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

**Verifying event detection (Phase 3):** open a real Ticketmaster event
page (a URL matching `ticketmaster.com/<slug>/event/<id>`), open DevTools
→ Console, and look for a `[setlist-scout] event detection:` log line.
This hasn't been checked against a live page from the dev environment
itself (see DEVLOG Phase 3 — Ticketmaster blocks automated fetches with a
bot-detection challenge) — checking it against a handful of real pages,
including a non-music event and a Ticketmaster page that isn't an event at
all, is a manual step still worth doing.

**Verifying the panel (Phase 4):** with `pnpm dev:worker` running
locally, open a real Ticketmaster event page for a touring artist — a
pill should appear bottom-right; click it to expand the panel. Force the
other states by editing `apps/extension/src/lib/worker-url.ts` or
temporarily stopping `wrangler dev` (network error), or by pointing
`?artist=` at something obscure via the worker directly first to see
`insufficient_data`/`artist_not_found` render. Not yet checked visually
in a live browser from this environment — see DEVLOG Phase 4.

**Options (Phase 5):** right-click the extension icon → Options (or
`chrome://extensions` → Setlist Scout → Extension options) to toggle
auto-expand and spoiler-free mode. Settings are stored in
`chrome.storage.local` and persist across browser restarts. Panel polish
this phase: a skeleton loader while fetching, Escape collapses an
expanded panel, dark mode follows the OS via `prefers-color-scheme`, and
real 16/32/48/128 icons.

**Screenshots:** not included yet — producing a real screenshot needs an
actual loaded extension in a real Chrome window on a real page, which
isn't something this dev environment can do (same limitation as the
Ticketmaster/panel verification above). Worth adding once someone loads
this for real; a fabricated "screenshot" would be worse than none.

**Second site (Phase 6):** dice.fm event pages (`dice.fm/event/*`) work
the same way as Ticketmaster's — same content script, same panel.
Bandsintown was the plan's other suggestion but 403s automated requests,
so it wasn't usable for building a real fixture from here.

**Bustouts (Phase 6):** songs that reappear in the current tour after a
2+ year gap show up in their own highlighted section in the panel.
Computing them means a second, wider setlist.fm fetch (3 years back), so
they're cached separately from the main aggregate (7-day freshness) and
may take a moment to appear on an artist's first request. Verified for
real against Phish's actual touring history — see DEVLOG Phase 6.

**Store readiness (Phase 7):** `pnpm --filter @setlist-scout/extension
build` now produces a production manifest with `host_permissions`
stripped down to nothing (localhost is dev-only; there's no deployed
worker URL yet to grant access to instead). Package it for upload with
`pnpm --filter @setlist-scout/extension package`, which zips whatever is
actually in `dist/` into `apps/extension/setlist-scout-v<version>.zip`.
See `PRIVACY.md` for the privacy policy and `STORE_LISTING.md` for draft
listing copy and an honest checklist of what's still needed before an
actual submission (a deployed worker, real screenshots, a hosted URL for
the privacy policy) — see DEVLOG Phase 7.

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

The worker deploys to the free `*.workers.dev` subdomain; no custom domain
is configured. **Not yet deployed as of Phase 2** — this environment isn't
logged into Cloudflare, so the actual `wrangler login` / namespace creation
/ deploy is a manual step for whoever has account access. Everything else
(caching, stale-on-error, CORS, throttling, `?mbid=`) is implemented and
verified locally via `wrangler dev`, which runs a local KV simulation
without needing a real namespace. Once deployed, put the live
`*.workers.dev` URL here.

### `/aggregate` behavior (Phase 2)

- `GET /aggregate?artist=<name>` or `GET /aggregate?mbid=<mbid>` (the
  latter skips MusicBrainz resolution).
- A response includes `cached: true` when served from KV without calling
  upstream, and additionally `stale: true` when it's a cached copy served
  because a live upstream call failed.
- CORS is restricted to `chrome-extension://*` origins plus
  `localhost`/`127.0.0.1` for local extension dev.
- Per-IP requests are throttled to 30/minute (KV-backed, best-effort, not
  exact under concurrent load — see `src/throttle.ts`).

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
  30-day TTL on name→MBID mappings). **Resolved 2026-09-01, deliberately, not
  by re-reading the terms differently:** keeping the 24h/30-day TTLs as
  planned. Reasoning: this is a free, non-commercial, low-traffic personal
  project, not a service reselling or mirroring setlist.fm's data — setlist
  data for a given artist typically doesn't change more than once a day
  (a new show gets logged, at most, once daily per artist), so a 24h
  aggregate cache doesn't meaningfully diverge from "immediately upon
  receipt" in practice, and a 30-day cache on a name→MBID mapping that
  almost never changes at all isn't the kind of thing these terms seem
  aimed at. This is a judgment call, not a legal opinion — if this project
  ever gets real traffic or attention, it's still worth actually asking
  setlist.fm rather than leaning on this reasoning indefinitely.
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
