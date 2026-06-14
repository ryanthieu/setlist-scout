# DEVLOG

## Post-release — chrome.storage unavailable in the content script — 2026-09-02

Second real bug found via live testing, right after fixing the first
(background service worker not loading). Once messaging to the
background worked, the panel got as far as mounting and then hit a new
uncaught error: `Cannot read properties of undefined (reading 'local')`,
originating in our own bundled code (`main.ts-*.js` in the stack trace).

**Root cause:** `chrome.storage` is `undefined` inside this project's
actual content script execution context in the live browser.
`mount.tsx` called `getOptions()`, which reads `chrome.storage.local`
directly -- that line threw before the panel could render anything
beyond the pill shell.

**A diagnostic dead end worth remembering:** I asked to check
`chrome.storage` from the page's own DevTools console, and it printed
`undefined` -- but that's not meaningful evidence either way. The
default DevTools console executes in the page's own JS world, not the
content script's isolated world; `chrome.storage` would print
`undefined` there regardless of whether the content script has real
access to it. The actual uncaught error (with a stack trace pointing
into our own compiled chunk) was the only reliable signal here, not
the console check I asked for.

**Fix:** added a `GET_OPTIONS` message, handled by the background
exactly like `GET_AGGREGATE` already is. The background's
`chrome.storage` access is proven working in production (it's what
backs the aggregate session cache), so this routes around whatever is
actually wrong with content-script storage access rather than
requiring a full diagnosis of *why* it's unavailable there. Dropped the
live `chrome.storage.onChanged` subscription that let an already-open
panel pick up option changes instantly -- it depended on the same
unavailable API. Removed `onOptionsChanged` from `lib/options.ts`
entirely rather than leave it as unused code once nothing called it.

**Decisions:**
- Didn't chase down *why* `chrome.storage` specifically is unavailable
  in the content script world here (dynamic-import-based ESM content
  scripts, which is how crxjs loads ours, are one candidate
  explanation, but unconfirmed). Routing around it via a channel
  already proven to work live was faster and more reliable than a
  deeper investigation with no browser access of my own to iterate
  against.

**Known gaps:**
- Options no longer live-update an already-open panel; changing a
  setting takes effect on the next page load. Worth revisiting if that
  turns out to matter in practice.
- The *why* behind content-script `chrome.storage` unavailability is
  still not understood, just routed around. If anything else ever
  needs a chrome.* API from inside a content script directly (not just
  storage), it may hit the same wall.
- Not yet re-verified live as of this entry -- confirmed only that the
  built background bundle now contains the `GET_OPTIONS` handling
  (`grep`'d the compiled chunk directly) and that all tests/build pass.

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (115
tests -- down from 117; removed 2 tests for the deleted
`onOptionsChanged`), and `pnpm build` all pass. Confirmed in the built
output: `GET_OPTIONS` appears in the compiled background chunk that
`service-worker-loader.js` actually imports.

## Post-release — the background service worker was never loading — 2026-09-02

Found by actually loading the unpacked extension in a real Chrome profile
and visiting a live Ticketmaster page for the first time -- the first
real end-to-end test this project has had. Every "not yet verified in a
live browser" gap noted throughout Phases 0-7 was exactly this kind of
risk; this is the first one that turned out to hide a real bug.

**Symptom:** the panel got stuck on the loading skeleton forever.
Console showed `[setlist-scout] event detection: Object` (detection
genuinely worked) immediately followed by `Uncaught (in promise) Error:
Could not establish connection. Receiving end does not exist.` -- the
signature of `chrome.runtime.sendMessage` finding no listener at all.

**Root cause:** `apps/extension/src/background/index.ts` and
`apps/extension/src/content/index.ts` share the identical basename
(`index.ts`) in different directories. crxjs's manifest-rewriting
resolved *both* the background `service_worker` entry and the content
script entry to the same compiled chunk -- the content script's code.
The background's real `onMessage` listener was being built into its own
chunk in `dist/`, but nothing in the generated manifest ever loaded it.
Reproduced identically across multiple from-scratch rebuilds (`rm -rf
dist node_modules/.vite`), so this wasn't stale build-cache noise -- it
was deterministic given these two entry filenames.

**Fix:** renamed both entries to distinct basenames
(`background/service-worker.ts`, `content/main.ts`) and updated
`manifest.config.ts` to match. Verified in the actual built output this
time, not just by re-running the existing test suite: grepped the
compiled chunks directly for `onMessage` vs. `attachShadow` and
confirmed `service-worker-loader.js` now imports the right one.

**Why none of Phases 0-7's tests caught this:** every background/panel
test imports `handleGetAggregate`, `Panel`, `aggregate-cache`, etc.
directly by module path and exercises them in isolation -- which is
exactly right for testing that logic, but it can never catch a bug in
how the *bundler* wires those modules into the actual shipped manifest.
"The modules work correctly" and "the bundler loads the right modules"
turned out to be two different claims, and only one of them had any
test coverage. This is the sharpest version yet of the "not verified in
a live browser" gap flagged in nearly every DEVLOG entry since Phase 0 --
worth remembering specifically as a *category* of bug that unit tests
structurally cannot catch, not just bad luck this one time.

**Known gaps:**
- No automated check exists for "does the built manifest actually wire
  up the entries I think it does." Could be added (e.g. a small script
  that inspects `dist/manifest.json` plus greps the referenced chunks
  for expected symbols, run as part of `pnpm build`), but wasn't added
  here -- this fix closes the one instance found, not the whole class
  of risk.
- Not yet re-verified live after this fix (the person testing hadn't
  reloaded the rebuilt unpacked extension and re-tested as of this
  entry). The fix is confirmed correct at the build-output level; full
  confirmation is "the panel actually shows real data on a live page."

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (117
tests, unchanged pass count -- this bug was invisible to all of them,
which is the point), and `pnpm build` all pass. Confirmed directly in
`dist/`: `service-worker-loader.js` imports the chunk containing
`onMessage`; the content script's loader imports the chunk containing
`attachShadow`. These were the same chunk before the fix and are
different chunks after it.

## Post-release — worker deployed for real — 2026-09-02

Not one of plan.md's seven phases -- this is the follow-up where the
biggest carried-forward gap (worker never actually deployed, flagged in
every DEVLOG entry from Phase 2 through Phase 7) finally closed, once I
had Cloudflare account access.

**Shipped:** `wrangler kv namespace create CACHE`, `wrangler secret put
SETLISTFM_API_KEY`, `wrangler deploy`. Live at
`https://setlist-scout-worker.ryanthieu1.workers.dev`. Wired the real KV
namespace id into `wrangler.toml`, the real URL into
`apps/extension/src/lib/worker-url.ts`'s production branch, and the same
URL (only that URL, not a wildcard) into `manifest.config.ts`'s
production `host_permissions`.

**Decisions:**
- The repo is now pushed to a GitHub remote
  (https://github.com/ryanthieu/setlist-scout) -- but it's **private**,
  which I got wrong in the first version of this entry and in
  `STORE_LISTING.md` (both briefly, incorrectly claimed this made
  `PRIVACY.md` publicly reachable and resolved that Phase 7 blocker; a
  private repo obviously doesn't do that). Corrected both in a
  follow-up commit rather than leaving the mistake standing. The
  privacy-policy-URL gap is still open.
- Did not edit the "Known gaps" text in the Phase 7 DEVLOG entry above
  to remove the now-resolved worker-deployment item. That entry is an
  honest record of what was true when Phase 7 actually shipped; this
  new entry is where "and now it's resolved" belongs. Editing history
  to make a past phase look more finished than it was at the time would
  defeat the point of keeping a DEVLOG at all. (This doesn't apply to
  the correction above -- that's fixing a mistake made minutes earlier
  in this same entry, not revising an honest past record.)

**Surprises:**
- The very first live `/aggregate?artist=Phish` request came back `502
  upstream_unavailable` (MusicBrainz). Retried a few seconds later and
  it succeeded, then stayed cached -- this matches the exact "503
  currently busy" flakiness from MusicBrainz documented back in Phase
  1, just now observed from Cloudflare's network instead of this dev
  sandbox's. Not a deployment bug; MusicBrainz is just occasionally
  slow to respond, and the stale-on-error path (Phase 2) exists
  precisely for this.

**Known gaps:**
- **No privacy policy URL still.** The GitHub repo is private, so
  `PRIVACY.md` isn't publicly reachable there. Needs either making the
  repo public or hosting the policy somewhere that actually is (e.g. a
  route on the now-deployed worker).
- Real screenshots -- needs a real browser loading the unpacked
  extension on a live page, which is still outside what either this
  environment or a backend deploy can provide.
- `git push` for this and the `v1.0.0` tag happened from a different
  session than the one that did Phases 1-7; worth noting only because
  it means the credentials/remote setup live outside this repo's own
  history (`.git/config`, not committed) -- anyone cloning fresh will
  need their own `wrangler login` and `gh` auth, this doesn't travel
  with the code.

**Verification:** hit the real deployed worker directly:
`GET /health` → `{"ok":true}`; `GET /aggregate?artist=Phish` → real
`status: "ok"` data matching what local `wrangler dev` testing produced
throughout Phases 1-6, after one transient MusicBrainz retry. Rebuilt
the extension and confirmed by hand: `dist/manifest.json`'s
`host_permissions` is exactly the one real worker URL, and the built
background bundle contains that URL with zero remaining references to
`localhost:8787`. Full `pnpm typecheck`/`lint`/`test`/`build` all still
pass (116 tests).

## Phase 7 — Store readiness — 2026-09-01

**Shipped:** the pieces of store-readiness that don't require a deployed
backend or a real browser -- permissions audit, an explicit production
build config, a real privacy policy, draft store listing copy with a
generated promo tile, a test formalizing the Phase 0 attribution
requirement, and the `v1.0.0` tag.

**Commits:** `5d6f60e` chore: production build config · `0f0ffc8` docs:
privacy policy and store listing · (this entry) · `chore: release
v1.0.0` (tag, after this entry)

**Decisions:**
- `host_permissions` is now conditional on `NODE_ENV`: `localhost:8787`
  ships in dev builds (`vite`, for testing against `wrangler dev`) and
  is stripped entirely from production builds (`vite build`). Confirmed
  this actually works rather than assuming: `vite build` sets
  `NODE_ENV=production` unconditionally regardless of `--mode`, which
  is exactly the distinction that matters here (`pnpm build` vs. local
  `pnpm dev`), not a mode flag. Production currently ships with zero
  host_permissions, which is correct and honest -- there's no deployed
  worker yet to grant access to.
- Wrote real privacy-policy content rather than a placeholder, but the
  Chrome Web Store form needs an actual *hosted* URL for it, which this
  repo doesn't have yet (no GitHub Pages, no deployed worker domain).
  Documented as a submission blocker rather than pretending the
  Markdown file alone satisfies the requirement.
- Generated the small promo tile (440×280) from the same SVG-based
  icon/color system as the app icons (`rsvg-convert`, no headless
  browser available). Deliberately did *not* attempt a fabricated
  "screenshot" of the panel in a mocked-up ticket page -- a promo tile
  is understood to be branding art, but a Chrome Web Store screenshot
  is supposed to show the real running product, and faking one (even
  built from the real CSS) would cross from "asset I can honestly
  produce" into "claiming to be something it isn't." Real screenshots
  are flagged as a submission blocker instead.
- Bumped the extension's own version to 1.0.0 (it's what
  `manifest.config.ts` reads for the shipped manifest version and what
  the package script embeds in the zip filename). Left the worker,
  shared package, and root package.json versions alone -- they're
  private/internal and don't correspond to anything a user or the
  Chrome Web Store sees; only the extension's version is externally
  meaningful here.
- Tagging `v1.0.0` locally marks this as the submission-candidate
  snapshot the plan's Phase 7 asks for, not a claim that it has
  actually been submitted or is deployed -- see Known gaps.

**Surprises:**
- None this phase -- no new upstream interaction, just build config
  and documentation.

**Known gaps -- genuinely blocking actual store submission, not just
loose ends:**
- **The worker still isn't deployed** (carried since Phase 2). Without
  it, `host_permissions` has nothing to point at and the extension
  can't fetch real data in production at all.
- **No real screenshots.** Needs an actual browser loading the unpacked
  extension on a live Ticketmaster or Dice page.
- **No hosted privacy policy URL.** The content is real and complete
  (`PRIVACY.md`); it just isn't reachable at a URL yet.
- Given the above, `v1.0.0` is a *candidate* tag -- the code is in the
  shape the plan's Phase 7 describes, but "publishable" in the literal
  sense (someone could actually click submit on the Chrome Web Store
  form right now) is not yet true. Whoever picks this up next should
  resolve the three items above before actually submitting, not treat
  the tag itself as permission to do so.

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (116 tests,
up from 114 -- 2 new covering the setlist.fm attribution link's href,
visible text, and absence of `nofollow`), and `pnpm build` all pass.
Built production output and confirmed by hand: `dist/manifest.json` has
an empty `host_permissions` array; a `vite build --mode development`
run confirmed `NODE_ENV` stays `production` regardless of `--mode`
(matching the intended dev-vs-build distinction, not a mode distinction).
Ran the new `pnpm --filter @setlist-scout/extension package` script and
inspected the resulting zip's contents directly (`unzip -l`) -- matches
`dist/` exactly, no sourcemaps, includes the options page.

## Phase 6 — Second site + bustouts — 2026-09-01

**Shipped:** a dice.fm adapter proving out the SiteAdapter abstraction from
Phase 3, and bustout detection -- songs that reappear in the current tour
after a 2+ year absence, surfaced as their own distinct section in the
panel.

**Commits:** `d5a69e9` feat(extension): dice.fm adapter · `d10b815`
feat(worker): bustout detection · `0918d0c` feat(extension): surface
bustouts in the panel

**Decisions:**
- Checked site reachability before picking a second site, rather than
  assuming from the plan's own hedge ("Dice or Bandsintown"). Bandsintown
  403s automated requests the same way Ticketmaster does; dice.fm serves
  real HTML with no bot challenge. Went with Dice for that reason alone --
  it's the one I could actually get a real fixture from.
- The abstraction genuinely held, with one real fix: Dice's JSON-LD has
  an array-valued `location` (multi-room venue), which the shared
  extractor only handled as a single object. Fixed in `json-ld.ts` itself,
  not special-cased per site, since it's a real JSON-LD variance either
  site could hit. Also extracted the MutationObserver-timeout wrapper and
  the JSON-LD DOM scan into shared modules so DiceAdapter is genuinely
  just `matches()` + `detect()` -- no copy-pasted orchestration.
- Bustouts use the *earliest* in-window appearance as the "comeback"
  date, not the latest -- if a song re-enters rotation and gets played
  three more times this tour, the bustout is the first night back, not a
  running tally of every subsequent play.
- A song with no appearance at all in the lookback data is skipped, not
  flagged. That could mean "genuinely brand new" or "gap wider than we
  looked back (3 years)" -- no way to tell which, so it says nothing
  rather than guessing.
- Bustouts are cached independently from the main aggregate (7-day
  freshness vs. the aggregate's 24h) because computing them means a
  second, much wider setlist.fm fetch (3 years back, up to 20 pages) --
  exactly the "expensive" the plan calls out. It's triggered from
  `handleAggregate` unconditionally whenever the aggregate status is
  "ok" (cache hit or not), but its own internal freshness check means
  that costs nothing beyond a KV read on all but roughly one request a
  week per artist.

**Surprises:**
- None on the worker side -- Phish's real history behaved exactly as
  expected once fetched.
- Debugging the live verification below turned up a self-inflicted
  false alarm, not a real bug: multiple `wrangler dev` processes ended
  up running on different ports across restarts (8787 and 8788), so a
  few verification requests silently hit a stale process running old
  code. Worth a note for future sessions: `pkill -f "wrangler dev"`
  before restarting isn't always enough to guarantee a clean single
  instance -- check `lsof -i :8787` if a request's behavior doesn't
  match the code you just changed.

**Known gaps:**
- `fetchArtistSetlists` (Phase 1) has no built-in pacing between
  sequential page requests -- fine at the main aggregate's 1-3 pages,
  more exposed at bustouts' up-to-20. Nothing failed in testing here,
  but a genuinely deep-catalog artist's bustout computation is the
  single most likely place this project would ever actually hit
  setlist.fm's rate limit. Not fixed this phase -- worth a real look if
  it ever happens for real rather than adding speculative throttling
  now.
- Dice has no DOM fallback (unlike Ticketmaster) since real pages
  reliably carry the JSON-LD -- if that ever proves false, Phase 3's
  brittle-DOM-selector pattern is right there to copy.
- The "second site" acceptance criterion ("both sites work from the
  same build") is confirmed at the manifest/bundle level -- one content
  script chunk, two match patterns -- but, same as Ticketmaster and
  Dice individually, hasn't been checked by loading the unpacked
  extension into a real Chrome profile on a live dice.fm page.

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (114 tests,
up from 90), and `pnpm build` all pass; the built manifest's
`content_scripts` matches both `ticketmaster.com/*/event/*` and
`dice.fm/event/*` against the same compiled chunk. Bustouts were
verified twice against real data: first by hand (fetched 25 real pages of
Phish history via curl/python, found genuine multi-year gaps -- "Back in
the U.S.S.R." after 12.7 years, several 2.5-3 year bustouts -- before
writing any assertions), then live against the actual running worker
(`wrangler dev`, real setlist.fm calls, no mocks), which independently
reproduced the same bustouts with matching dates and gap lengths.

## Phase 5 — Polish — 2026-09-01

**Shipped:** an options page (auto-expand, spoiler-free mode, persisted
in `chrome.storage.local`), real icons, a skeleton loader instead of
"Loading...", keyboard-dismissible panel (Escape), dark mode via
`prefers-color-scheme`, and empty-state copy that explains why there's
no data instead of just failing quietly.

**Commits:** `b59f31c` feat(extension): options page, spoiler-free
mode, and panel polish

**Decisions:**
- One commit, not the plan's three. Options, spoiler-free mode, and
  the visual polish items all landed in the same `Panel.tsx`/`styles.ts`
  rewrite as I actually built them -- there's no real prior working
  state where, say, the options page exists without spoiler-free mode,
  since `OptionsPage.tsx` had both toggles from the first version I
  wrote. Same reasoning as Phases 2 and 4's commit consolidations.
- `autoExpand` only seeds the panel's *initial* expanded/collapsed
  state (via `useState(options.autoExpand)`); `spoilerFree` is read
  live on every render instead. Reasoning: auto-expand is a "what
  should happen when this panel first appears" preference -- flipping
  it in the options page shouldn't reach into an already-open tab and
  yank the panel open or shut. Spoiler-free is closer to a safety
  toggle -- if someone remembers mid-browse that they want spoilers
  hidden, it should take effect without needing to reload the page.
  `mount.tsx` subscribes to `chrome.storage.onChanged` and re-renders
  with fresh options on any change, which is what makes the live half
  of that actually work.
- Icons are a plain generated asset (a rounded-square mark with a
  white music note), not commissioned art -- rendered at 16/32/48/128
  from one SVG via `rsvg-convert`. Fine for "something you'd hand to a
  friend," not meant to be a final brand identity.
- Escape collapses the expanded panel back to a pill rather than fully
  dismissing it. "Keyboard-dismissible" was ambiguous between "closes
  like the X button" and "closes like the collapse button" -- went
  with the more reversible interpretation (matches common
  modal/popover convention: Escape closes/minimizes, it doesn't
  usually trigger a more destructive action than a mouse click would).
- No real screenshots in the README. A screenshot needs an actual
  loaded extension in a real Chrome window on a real page, which this
  environment can't produce -- adding a fabricated image claiming to
  be a real screenshot would be actively misleading, not just
  incomplete. Documented as a follow-up for whoever loads this for
  real, same as the Phase 3/4 live-browser gaps.

**Surprises:**
- None upstream -- Phase 5 touched only the extension's own UI/storage
  layer, no new API interaction.

**Known gaps:**
- **The plan's actual Phase 5 acceptance criterion -- "a fresh Chrome
  profile can load the extension and get a working panel without any
  setup" -- is not met, and can't be until Phase 2's worker deploy
  happens.** `WORKER_URL` still resolves to `""` outside dev (see
  Phase 2/4 DEVLOG entries), so a fresh install hits
  `worker_not_configured` instead of real data. This isn't a Phase 5
  regression -- it's the same carried-forward gap surfacing at the
  point where the plan finally asks to verify it end-to-end.
- Options persistence itself (`chrome.storage.local` surviving a
  browser restart) is inherent Chrome behavior, not something our code
  could break -- verified that the extension correctly reads and
  writes through that API, but an actual restart-and-reopen check
  needs a real browser.
- Icons and the options page layout haven't been looked at in an
  actual `chrome://extensions` listing or options tab -- only unit
  tested and inspected via the built `dist/manifest.json` and
  `dist/src/options/index.html`.
- No visual dark-mode check against a real OS dark-mode toggle --
  the CSS is structured correctly (custom properties overridden under
  `prefers-color-scheme: dark`) but unverified visually.

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (90 tests,
up from 79 -- 11 new covering options get/set/change-notification, the
options page's rendering and persistence, panel auto-expand,
spoiler-free rendering, and keyboard-dismiss), and `pnpm build` all
pass. Inspected the built `dist/manifest.json` by hand: `icons` and
`options_page` both wired correctly, and `dist/src/options/index.html`
correctly references its bundled script and stylesheet. Rendered the
icon SVG at all four sizes and visually confirmed (via the Read tool)
that the mark stays legible down to 16px.

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
