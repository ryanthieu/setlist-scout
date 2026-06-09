# DEVLOG

## Phase 4 — Extension: the panel — 2026-09-01

**Shipped:** the overlay actually appears. When an artist is detected on a
Ticketmaster event page, a React panel mounts into a shadow root
(collapsed to a pill by default), sends `GET_AGGREGATE` to the background
service worker, and renders locks, rotating songs, set-length/encore
stats, and the setlist.fm attribution link -- or a legible message for
every non-happy state (loading, insufficient data, artist not found,
network error, stale data).

**Commits:** `29ea684` feat(extension): background fetch bridge and
per-session cache · `6132aa4` feat(extension): shadow DOM panel with all
states

**Decisions:**
- Two commits instead of the plan's four. `mount.tsx` inherently renders
  `<Panel>`, so there's no real intermediate state where "shadow DOM
  mount" exists as working code without the panel UI behind it -- same
  reasoning as Phase 2's caching/stale-on-error consolidation. The actual
  seams in what I built are "the message/cache/fetch plumbing" and "the
  panel and its shell," so that's what the two commits are.
- Moved `normalizeArtistQuery` and the worker's response-body type (now
  `AggregateResponse` in `packages/shared`) out of worker-only code. The
  extension needs the exact same normalization and the exact same wire
  shape the worker returns; duplicating either invites drift. Added a
  `packages/shared/src/index.ts` barrel so this could happen without
  breaking existing `@setlist-scout/shared` imports elsewhere.
- `Panel` takes `requestAggregate` as a prop rather than calling
  `chrome.runtime.sendMessage` itself. That's what makes it fully
  testable via real React rendering (createRoot + act) with zero chrome
  API mocking -- only `mount.tsx` needs the real
  `chrome.runtime`-backed implementation, and only its own tests need a
  `chrome` stub.
- `WORKER_URL` resolves to `""` outside dev (worker isn't deployed --
  Phase 2 gap) rather than a guessed `*.workers.dev` URL. An empty target
  fails cleanly as `worker_not_configured`, and `host_permissions` stays
  scoped to `localhost` instead of a broad wildcard granted for a URL
  that doesn't exist yet.
- The panel only surfaces `lock` and `rotating` tier songs, never `rare`
  -- matches the plan's stated layout (Locks, then Rotating) and happens
  to be a reasonable default before Phase 5's spoiler-free toggle exists.
- Dismiss state is plain component state, not persisted anywhere.
  "Stays dismissed for that page load" doesn't need `chrome.storage` --
  the page unloading already clears it.

**Surprises:**
- None upstream this phase -- no new API calls, just wiring the pieces
  from Phases 1-3 together.

**Known gaps:**
- **Not visually verified on a live Ticketmaster page.** I manually
  confirmed the actual background fetch bridge against the real running
  local worker (no mocks: `handleGetAggregate` genuinely fetched and
  cached live Phish data from `wrangler dev`), and the panel's rendering
  logic is fully covered by real React-rendering tests for every state.
  What I can't do from here is load the unpacked extension into Chrome
  and confirm it visually on a real page -- same category of gap as
  Phases 0 and 3.
- Host page style isolation (the other half of that acceptance
  criterion) is only reasoned about, not measured: shadow DOM blocks
  style leakage by construction, and `all: initial` plus explicit resets
  guard against inherited properties, but I haven't put it on an actual
  CSS-heavy page like Ticketmaster to check for a surprise like a
  page-level `!important` rule reaching in some other way.
- The panel pill doesn't summarize anything (it's just a static "🎵
  Setlist Scout" label) -- deliberately simple for this phase, but worth
  a look once Phase 5's polish pass happens.
- `WORKER_URL` needs the real `*.workers.dev` URL filled in, and
  `host_permissions` needs it added, once Phase 2's deploy actually
  happens.

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (79 tests,
up from 54 -- 25 new in the extension package covering the cache,
fetch-bridge orchestration, view-state mapping, the full Panel component
across every state via real React rendering, and shadow-root mount
isolation), and `pnpm build` all pass. Additionally ran a temporary,
not-committed test that called `handleGetAggregate` with no mocks at all
against `wrangler dev` running locally -- confirmed it genuinely fetches
and caches real Phish data end-to-end, then deleted that file (it was a
one-off manual check, not something that belongs in the permanent suite
given it depends on a live local server).

## Phase 3 — Extension: event detection — 2026-09-01

**Shipped:** a content script that runs on Ticketmaster event pages,
extracts `{ artist, date, venue, city }` from the page's own JSON-LD (or a
DOM-selector fallback if that's missing), and logs it to console. No UI,
no network calls -- just proving detection works before building anything
on top of it.

**Commits:** `ad9444d` feat(extension): site adapter interface ·
`32bc881` feat(extension): ticketmaster event detection

**Decisions:**
- Automated fetches of Ticketmaster from this environment (both `curl`
  and the sandboxed WebFetch tool) get a 401 behind an Akamai-style
  "Let's Get Your Identity Verified" bot challenge -- real HTTP clients
  without a full browser engine can't get past it. Since "don't write a
  parser against a shape you haven't seen" is a hard rule here, I asked
  for real page source pasted in by hand instead of guessing at the
  schema.org spec. That turned out to matter immediately (see Surprises).
- `EventContext` went into `packages/shared/src/types.ts` (per the
  plan's own repo-layout comment); `SiteAdapter` stayed extension-local
  in `src/content/adapters/site-adapter.ts` since it's a behavioral
  contract about how content scripts work, not a cross-cutting data
  shape the worker has any reason to know about.
- Skipped `host_permissions` in the manifest this phase. The plan's Phase
  3 bullet mentions adding it for the worker URL, but nothing in this
  phase makes a network call -- that's Phase 4's background-fetch
  bridge -- and the worker isn't deployed yet anyway (Phase 2 gap), so
  there's no real URL to grant permission for. `content_scripts.matches`
  alone is what Chrome needs to inject on Ticketmaster event pages.
- The DOM fallback intentionally avoids Ticketmaster's styled-components
  class names (things like `sc-85d93237-7`, which look deterministic but
  are hash-generated per build and will rot fast) in favor of structural
  signals: the page's `<h1>`, an anchor linking to `/venue/`, and a
  regex over the visible body text for the "Day • Mon DD, YYYY • H:MM
  AM/PM" pattern. Still brittle by nature (that's the whole reason it's
  a fallback), just not brittle in the "breaks on the next Ticketmaster
  deploy" way specifically.

**Surprises:**
- Real Ticketmaster JSON-LD uses `"performers"` (plural, an array) for
  the artist list, not schema.org's documented singular `"performer"`.
  Had I written this against the spec instead of a real fixture, artist
  detection would have silently returned nothing on every real page.
  The extractor now accepts both keys, singular or array-valued.
- The fixture I got back (Chance The Rapper, with opener La Reezy) is
  itself a genuine multi-performer bill, which happened to cover that
  specific acceptance-criteria case with real data without needing to
  ask for a second one.
- The JSON-LD script tags sit in the page markup right after a large
  `<noscript>` fallback block, which briefly looked (from a naive read
  of the raw HTML) like the JSON-LD itself might be nested inside
  `<noscript>` -- which would make it invisible to a content script
  running with JS enabled. It isn't; the `<script>` tags are siblings
  after `</noscript>` closes, not children of it. Worth having actually
  checked rather than assumed either way.

**Known gaps:**
- **The plan's actual acceptance criteria -- 5 real Ticketmaster event
  pages including a multi-artist bill and a non-music event, verified
  live -- have not been run.** I have one real fixture (a multi-artist
  hip-hop bill) exercised end-to-end through the real adapter code via
  jsdom, plus synthetic-but-realistic cases for a non-music event's
  JSON-LD and a non-event page. That's real coverage of the parsing
  logic, but it is not the same as loading the unpacked extension in
  Chrome and confirming detection against 5 different genuinely live
  pages, which needs a real browser I don't have access to from here.
  This mirrors Phase 0's "load unpacked and confirm" gap -- it's a
  manual step for whoever has a browser, not something to fake a
  pass on.
- The DOM fallback has exactly one real page's markup behind it. It's
  designed around structural signals rather than one page's exact
  classes, but "designed to generalize" and "verified to generalize"
  aren't the same thing -- it hasn't been checked against a second real
  Ticketmaster template (a non-music event page might lay out its
  header differently).
- `host_permissions` for the worker URL is deferred to whenever the
  worker actually has a deployed URL and Phase 4 needs to fetch it (see
  Decisions above).
- The artist for a multi-performer bill is always the first entry in
  `performers`/`performer`. That's the headliner in the one real example
  seen so far, but nothing in the data guarantees ordering; worth
  revisiting if it turns out to matter for openers-billed-first cases.

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (54 tests,
up from 37 -- 17 new in the extension package, which had none before this
phase), and `pnpm build` all pass. The built `dist/manifest.json` was
inspected by hand: `content_scripts` matches
`https://www.ticketmaster.com/*/event/*` and points at the compiled
content script chunk. The real fixture (genuine Ticketmaster JSON-LD)
is exercised through the actual `TicketmasterAdapter.detect()` via
jsdom, not just the pure parser -- confirmed it returns exactly
`{ artist: "Chance The Rapper", date: "2026-09-13T20:00:00.000Z", venue:
"Moody Amphitheater", city: "Austin", source: "jsonld" }`. Loading the
unpacked extension into a real Chrome profile and confirming against
live pages is still outstanding, as noted above.

## Phase 2 — Worker: caching and hardening — 2026-09-01

**Shipped:** `/aggregate` is now safe to point a public extension at.
KV-backed caching on both the mbid resolution and the aggregate itself,
with stale-on-error fallback when either upstream is unreachable, CORS
locked to the extension + localhost, a basic per-IP throttle, and
`?mbid=` as a resolution-skipping alternative to `?artist=`. No live
deploy yet -- see Known gaps.

**Commits:** `4dd6a8d` feat(worker): KV caching with stale-on-error
fallback · `3840bab` feat(worker): CORS, per-IP throttling, and mbid
shortcut on /aggregate

**Decisions:**
- Settled the setlist.fm caching-terms tension flagged back in Phase 0/1:
  keeping the 24h/30-day TTLs from the plan, as a documented judgment call
  for a free non-commercial low-traffic project rather than a legal
  reading of "short periods." Written up in the README with the actual
  reasoning, not just "decided to keep it."
- Combined "KV caching" and "stale-on-error" into one commit instead of
  the two the plan sketched. In the actual implementation they're the
  same code path -- the try/catch around each upstream call is what
  decides both "do I have a cache hit" and "do I fall back to a stale
  one," so there's no real intermediate state where caching exists
  without the fallback.
- Implemented the 24h/30-day TTLs as *logical* freshness windows checked
  against a stored timestamp, not as KV's own `expirationTtl`. The
  physical KV entry lives much longer (30 days for aggregates, 90 for
  mbid mappings) than its "fresh" window, specifically so it's still
  there to serve as a stale fallback well after it stops being served as
  a normal cache hit. A literal `expirationTtl: 24h` would have deleted
  the exact data the stale-on-error path needs.
- Extracted the resolve-then-aggregate orchestration out of index.ts into
  `handle-aggregate.ts` as a function that takes its KV, API key, and the
  resolveArtist/fetchArtistSetlists calls themselves as parameters. This
  follows the DI pattern the Phase 1 modules already used
  (`fetchImpl` on `resolveArtist`/`fetchArtistSetlists`) and is what made
  the stale-on-error and cache-freshness paths actually unit-testable --
  tests inject a failing upstream fn and a fixed `now` past the freshness
  window, rather than needing a real outage or a real 24 hours to pass.
- The per-IP throttle is a plain KV read-then-write counter, explicitly
  not atomic. Documented in `throttle.ts` and the README as "stops one
  broken client," not a real rate limiter -- concurrent requests from the
  same IP in the same window can race a few requests past the limit.
  Fine for this project's actual threat model right now.

**Surprises:**
- Nothing upstream-related this phase -- Phase 2 didn't add new upstream
  calls, just wrapped the existing Phase 1 ones in caching/fallback logic.
- Cloudflare auth expired/wasn't configured in this environment
  (`wrangler whoami` failed non-interactively), which was caught before
  writing any code by checking it up front rather than discovering it at
  the "deploy and record the URL" acceptance step.

**Known gaps:**
- **Not deployed to Cloudflare.** This environment has no Cloudflare
  login and can't run the interactive OAuth flow. All of Phase 2's
  behavior is implemented and verified against `wrangler dev`'s local KV
  simulation, which works without a real namespace -- but the actual
  `wrangler login`, `wrangler kv namespace create CACHE`,
  `wrangler secret put SETLISTFM_API_KEY`, and `wrangler deploy` are
  manual steps for whoever has account access. The README has the exact
  commands. Once deployed, the KV namespace id placeholder in
  `wrangler.toml` needs to be replaced with the real one, and the live
  URL needs to go in the README.
- Stale-on-error is thoroughly covered by unit tests (which inject a
  failing fetch fn and a `now` past the freshness window) but wasn't
  exercised against the live worker with real upstream APIs -- doing that
  honestly would mean either waiting out a real 24 hours or temporarily
  breaking the real API key mid-session, and I didn't want to fake a
  verification I couldn't actually perform. Flagging this explicitly
  rather than quietly skipping it.
- The throttle's non-atomicity (above) is a known, accepted gap, not an
  oversight.
- No negative caching (a MusicBrainz "no confident match" isn't cached),
  so a garbled artist name hits MusicBrainz fresh on every request. Not
  in the plan's Phase 2 scope; worth revisiting if abuse ever shows up.

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (37 tests,
up from 17), and `pnpm build` all pass. Ran `pnpm dev:worker` and
confirmed live, against real MusicBrainz/setlist.fm calls: a first
`/aggregate?artist=Phish` request took ~1.1s and returned `cached: false`;
a second identical request returned in ~0.02s with `cached: true`.
`?mbid=` with Phish's real mbid returned the correct cached result without
calling MusicBrainz. CORS: a `chrome-extension://` origin got
`Access-Control-Allow-Origin` echoed back; a random `https://` origin got
no CORS header at all. Firing 35 rapid requests at the same IP produced
`200`s followed by `429`s once the per-minute limit was hit. Confirmed
`.dev.vars` still never appears in `git status`/`git diff`.

## Phase 1 — Worker: resolve → fetch → aggregate — 2026-09-01

**Shipped:** `GET /aggregate?artist=<name>` resolves a name via
MusicBrainz, pulls recent setlists from setlist.fm, and returns a computed
`ArtistAggregate` -- locks/rotating/rare tiers, median set length, encore
frequency, and an insufficient-data path for artists who aren't touring
enough right now for the numbers to mean anything. No caching yet.

**Commits:** `42d0331` feat(worker): resolve artists via MusicBrainz ·
`bfacf58` feat(worker): setlist.fm client · `2215595` feat(worker): setlist
aggregation · `3ac0c92` test(worker): fixtures and aggregation tests ·
`30c3e02` feat(worker): wire up GET /aggregate

**Decisions:**
- Used real, live API responses for all four fixtures instead of anything
  hand-written, per the working agreement. Picked Phish (heavy toucher,
  18 qualifying shows in the 90-day window), Olivia Rodrigo (mostly-fixed
  pop setlist, with two low-song-count guest-appearance shows that
  correctly get dropped), Taylor Swift (genuinely insufficient data --
  only 3 shows even after widening to 180 days), and "Kaiser" as the
  fourth. That last one didn't turn out to be an ambiguous *name*
  resolution in the sense the plan meant -- see Surprises.
- `fetchArtistSetlists` stops paginating once a page's oldest show is
  older than the aggregation window (180 days, the wider of the two
  possible windows) rather than always walking every page. Phish alone
  has 2000+ setlists on record; fetching all of them on every cold
  request would be its own performance problem before Phase 2 caching
  exists.
- Added a guard aggregate.ts doesn't ask for: if every show in the
  window turns out to be a partial/festival set (dropped for having
  <5 songs), return `insufficient_data` instead of dividing by zero. None
  of the four sample artists hit this, but it's a real crash otherwise,
  not a hypothetical.
- `sourceUrl` comes from the first setlist's embedded `artist.url` rather
  than being constructed from the mbid, since setlist.fm's slugs aren't
  derivable from the mbid alone.

**Surprises:**
- MusicBrainz's search scores an exact (case-insensitive) name match at
  100 essentially always, regardless of how obscure that artist is. I
  expected "ambiguous name" queries (two well-known acts sharing a name)
  to produce a middling top score I could test the <90 threshold against.
  In practice that never happened across a dozen tries -- querying
  "Kaiser" resolves confidently to Roland Kaiser (a German schlager
  singer, score 100) over Kaiser Chiefs (score 93), because the search is
  matching strings, not fame. The score-threshold heuristic from the plan
  doesn't catch this class of mistake at all; it only protects against
  *no* good match existing. Kept it as a documented known limitation
  (`musicbrainz.ts`) rather than trying to fix it now -- fixing it
  probably means letting the caller disambiguate, which is a real feature,
  not a Phase 1 fix.
- Confirmed setlist.fm still publishes no numeric API rate limit anywhere
  I could find, even from the developer dashboard with a live key.
  MusicBrainz does publish one (1200/window via `x-ratelimit-limit`), but
  a burst of unauthenticated-feeling requests during fixture-gathering
  still got a `503 currently busy` under that limit -- the documented
  number isn't the practical ceiling.
- Real Taylor Swift data doubled nicely as the "insufficient data" fixture
  without needing to go looking for an inactive artist -- she just hasn't
  played more than a couple of one-off shows in the last 180 days as of
  this fixture pull.

**Known gaps:**
- The setlist.fm caching-terms conflict from Phase 0 is still unresolved
  and now blocks Phase 2 for real, not just in principle.
- No genuine sub-90-score "ambiguous name" fixture exists. If that
  disambiguation UX ever gets built, it needs a different kind of test
  case than what's here -- something in the response shape itself
  (multiple similarly-scored candidates), not the top score alone.
- Rate limiting/serialization is "don't fire requests in parallel," not
  an actual queue or backoff. Fine for one request at a time locally;
  not fine yet for concurrent traffic once this is public (Phase 2).
- `bustouts` is intentionally absent from `ArtistAggregate`, per the plan
  deferring it to Phase 6.

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (17 tests,
all against real fixture data plus two synthetic boundary/tape-exclusion
cases), and `pnpm build` all pass. Ran `pnpm dev:worker` and hit
`/aggregate` live for all four fixture artists (Phish, Olivia Rodrigo,
Taylor Swift, Kaiser) plus a garbled name -- every response matched what
the fixture-based tests predicted exactly. Confirmed `.dev.vars` (holding
the real setlist.fm key) never appears in `git status`, `git diff`, or any
commit.

## Phase 0 — Scaffold and guardrails — 2026-09-01

**Shipped:** a pnpm workspace that builds, lints, and tests cleanly.
`apps/extension` is a no-op MV3 extension (crxjs + Vite); `apps/worker` is a
Hono app serving `GET /health`; `packages/shared` is an empty placeholder for
Phase 1's types.

**Commits:** `9b816cc` chore: scaffold monorepo, extension shell, and worker

**Decisions:**
- pnpm itself had to come from `npm install -g pnpm@9` instead of corepack —
  corepack's signature verification against the npm registry's current
  signing key failed outright (`Cannot find matching keyid`), and corepack
  had already left broken shim symlinks for `pnpm`/`pnpx` that had to be
  removed first. Went with pnpm 9.x rather than the corepack-suggested
  pnpm 11, since 11 requires Node ≥22.13 and I hadn't decided on the Node
  version yet at that point.
- Pinned the repo to Node 22 (`.nvmrc`, `engines` in root package.json)
  because wrangler 4.x hard-refuses to run under Node 20, which is this
  machine's default. Node 22 was already installed via nvm, just not
  selected by default.
- Worker `build` script is `wrangler deploy --dry-run --outdir dist` rather
  than a separate bundler — wrangler already bundles from `src/index.ts`,
  and `--dry-run` gives a real "does this actually build" signal without
  touching Cloudflare.
- Added a smoke test for `/health` (Hono's `app.request()`) even though
  Phase 0's acceptance criteria didn't require it — it's the cheapest
  possible proof that `pnpm test` actually exercises something, not just a
  no-op pass.

**Surprises:**
- `vitest` (via `vite` 8, which now defaults to the Rolldown-based bundler)
  failed on first run with a missing native binding
  (`@rolldown/binding-darwin-arm64`) — a pnpm optional-dependency
  resolution miss, not a real incompatibility. `pnpm install --force` fixed
  it; a plain reinstall would probably also have worked.
- Vite 8's native config loader warned about the `./manifest.config` import
  (no extension) and the `./package.json` import (no `with { type: "json"
  }` attribute) as things that'll be hard errors in a future Vite major.
  Fixed both now rather than leaving a warning that silently rots.
- The setlist.fm API terms (read at
  https://www.setlist.fm/help/api-terms) say caching is limited to "short
  periods" with data distributed "immediately upon receipt." The plan's
  Phase 2 design (24h aggregate cache, 30-day MBID cache) is in tension
  with that literal language. Recorded in the README as unresolved —
  needs a real decision before Phase 2, not a default to "24h is probably
  fine."

**Known gaps:**
- `wrangler.toml`'s KV namespace id is a placeholder
  (`REPLACE_WITH_REAL_KV_NAMESPACE_ID`). Fine for now since nothing reads
  or writes it until Phase 2, but `wrangler dev`/`deploy` will need a real
  namespace created first.
- No `SETLISTFM_API_KEY` yet — `.dev.vars.example` documents the shape,
  actual `.dev.vars` isn't created (gitignored, and there's no key to put
  in it yet).
- The setlist.fm caching-terms conflict above is unresolved, not just
  undocumented.
- Extension `dist/` was verified by inspecting `manifest.json` and the
  build output directly; loading it into `chrome://extensions` still
  needs a manual check since I don't have browser access from here.

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm
build` all pass under Node 22. `pnpm dev:worker` was started in the
background and `curl localhost:8787/health` returned `{"ok":true}`
(confirmed in the wrangler dev log too). Extension `dist/manifest.json`
inspected by hand and looks like a valid MV3 manifest; load-unpacked in
Chrome itself is a manual step outside what I can run.

<!--
## Phase N — <name> — YYYY-MM-DD

**Shipped:** one or two sentences on what now works that didn't before.

**Commits:** `abc1234` feat(worker): ... · `def5678` test(worker): ...

**Decisions:** choices made that weren't in the plan, and why.

**Surprises:** anything upstream that behaved differently than documented.
This is the most useful section — write it even when it feels obvious.

**Known gaps:** what's deliberately unfinished, what's fragile, what will
break first.

**Verification:** what was actually tested, and how.
-->
