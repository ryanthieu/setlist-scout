# DEVLOG

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
