# Setlist Viewer — Implementation Plan

A Chrome extension that overlays setlist intelligence onto ticket purchase pages. When you're looking at an event page for an artist, it tells you what they've actually been playing on this tour.

This document is the source of truth for phased implementation. Each phase is a self-contained unit of work that ends in a passing build, a clean commit, and a DEVLOG entry.

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Shared types across extension and worker |
| Monorepo | pnpm workspaces | Two deployables + shared types |
| Extension build | Vite + `@crxjs/vite-plugin` | MV3-aware, HMR for content scripts |
| Panel UI | React 18, rendered into Shadow DOM | Familiar; shadow root prevents host-page CSS bleed |
| Panel styles | Plain CSS in a `<style>` tag inside the shadow root | Tailwind doesn't cross shadow boundaries without extra config |
| Backend | Cloudflare Worker + Hono | Hides the API key, caches aggregates, one place to fix upstream quirks |
| Cache | Cloudflare KV | Per-artist aggregate, ~24h TTL |
| Tests | Vitest | Aggregation logic and adapters are pure functions — easy to test |
| Lint/format | Biome | Single tool, no config sprawl (swap for ESLint + Prettier if preferred) |
| Package manager | pnpm | Workspace support |

### Repo layout

```
setlist-scout/
  apps/
    extension/
      src/
        background/       # MV3 service worker — all network calls
        content/          # per-site detection + panel mount
          adapters/       # ticketmaster.ts, dice.ts, ...
        panel/            # React components
        lib/
      manifest.config.ts
      vite.config.ts
    worker/
      src/
        index.ts          # Hono routes
        musicbrainz.ts    # name -> MBID resolution
        setlistfm.ts      # upstream client
        aggregate.ts      # the actual product logic (pure)
      test/
        fixtures/         # real API responses, saved to disk
      wrangler.toml
  packages/
    shared/
      src/types.ts        # ArtistAggregate, SongStat, EventContext
  DEVLOG.md
  CLAUDE.md
  README.md
```

---

## 2. Working agreement for Claude Code

Put this in `CLAUDE.md` at the repo root so it's loaded automatically every session.

```markdown
# Working agreement

## Scope discipline
- Work on ONE phase at a time. The phase is named in the prompt.
- Do not implement features from later phases, even if they seem trivial.
  If you think a later phase should move earlier, say so and stop.
- If a phase's acceptance criteria are ambiguous, ask before writing code.

## Before every commit
Run, in order, and fix anything that fails:
1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`
Then perform the phase's manual verification steps and report the result.
Do not commit if any step fails. Do not disable a check to make it pass.

## Commits
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
- Scope by package: `feat(worker): add MBID resolution`
- One logical change per commit. A phase may produce several.
- Never commit secrets, `.dev.vars`, `dist/`, or `node_modules/`.

## Commit attribution
This repo is authored under a single identity. Commit messages contain the
change and nothing else.

- Do NOT append `Co-Authored-By:` trailers, `Generated with Claude Code`
  footers, session URLs, emoji badges, or any other tooling metadata.
- Do NOT set or override `GIT_AUTHOR_*` / `GIT_COMMITTER_*` environment
  variables. The repo's configured `user.name` and `user.email` are correct
  as-is.
- Do NOT pass `--author`, `--date`, or `--amend` to rewrite authorship or
  timestamps.
- Write the message body in the voice of someone explaining the change to a
  teammate: what changed and why. Present or past tense, first person where
  natural. No "as requested," no "this commit implements," no restating the
  phase number.

Bad:
```
feat(worker): implement setlist aggregation as specified in Phase 1

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

Good:
```
feat(worker): aggregate setlists into per-song play rates

Groups songs across recent shows and buckets them by how often they're
played. Drops shows with fewer than 5 songs since festival slots were
skewing the percentages.
```

## DEVLOG
After the final commit of a phase, append an entry to DEVLOG.md using the
template at the bottom of that file. Be honest in "Known gaps" — that section
is the handoff to the next session and is more valuable than the summary.

Write DEVLOG entries in first person, as the repo author's own notes. No
third-person narration of the session, no references to prompts, phases-as-
instructions, or the assistant. "Hit a wall with Ticketmaster's SPA timing"
rather than "The user asked me to handle SPA timing."

## Code style
- No `any`. Use `unknown` and narrow.
- Network calls only in the worker or the extension's background service worker.
  Content scripts communicate via `chrome.runtime.sendMessage`.
- Pure logic (aggregation, parsing) goes in functions that take data and return
  data, with no I/O. These get unit tests. Everything else may not.
- Prefer failing loudly in development and degrading silently in production.

## What not to do
- Don't add dependencies without saying why in the commit body.
- Don't refactor code outside the current phase's scope.
- Don't write code against an API response shape you haven't actually seen.
  Fetch a real response, save it as a fixture, then write the parser.
```

### How to prompt each phase

```
Read CLAUDE.md and DEVLOG.md, then read Phase N in plan.md.
Implement Phase N only. Ask me anything ambiguous before you start writing code.
When done: run the check sequence, walk me through the manual verification,
commit, and append the DEVLOG entry.
```

---

## 3. Phases

### Phase 0 — Scaffold and guardrails

**Goal:** an empty repo that builds, lints, tests, and loads in Chrome as a no-op extension.

**Tasks**
- `pnpm init` workspace with `apps/extension`, `apps/worker`, `packages/shared`.
- Root scripts: `typecheck`, `lint`, `test`, `build` that fan out to all packages.
- Biome config, `.gitignore`, `.editorconfig`.
- Extension: minimal MV3 manifest (name, version, empty background worker), Vite + crxjs building to `dist/`.
- Worker: Hono app with `GET /health` returning `{ ok: true }`. `wrangler.toml` with a KV namespace binding declared but unused.
- `CLAUDE.md` (content above), `DEVLOG.md` with the template, `README.md` with setup steps.
- **Commit attribution config.** Two layers, because the setting alone has been unreliable:
  1. `.claude/settings.json`:
     ```json
     { "attribution": { "commit": "", "pr": "" } }
     ```
     `attribution` supersedes the older `includeCoAuthoredBy` flag and takes precedence if both are set. Empty strings suppress the text entirely. Use `.claude/settings.local.json` instead if you'd rather keep it out of the repo — that file is gitignored automatically.
  2. A `commit-msg` hook as the backstop, since the setting is periodically reported as not applying when the message is composed directly in a shell command:
     ```bash
     #!/usr/bin/env bash
     sed -i.bak -E '/^(🤖 )?Generated with \[?Claude Code/d; /^Co-Authored-By: Claude/d; /^https:\/\/claude\.ai\/code\//d' "$1"
     rm -f "$1.bak"
     ```
     Commit it as `.githooks/commit-msg`, then `git config core.hooksPath .githooks` so it survives a fresh clone.
- Confirm `git config user.name` and `user.email` are set to your identity before the first commit.
- **Read the setlist.fm API terms of use** and record in the README what attribution the UI must display and whether Web Store distribution is permitted. If anything is unclear, note it and flag it — this can change the design and it's cheapest to know now.

**Acceptance**
- `pnpm build` produces `apps/extension/dist` and a bundled worker.
- `chrome://extensions` → Load unpacked → `apps/extension/dist` loads with no errors.
- `pnpm dev:worker` serves `/health` locally.

**Commit:** `chore: scaffold monorepo, extension shell, and worker`

---

### Phase 1 — Worker: resolve → fetch → aggregate

The core product logic. No caching, no extension. Build it as an endpoint you can hit in a browser.

**Goal:** `GET /aggregate?artist=The%20Strokes` returns a computed `ArtistAggregate`.

**Upstream notes**

*MusicBrainz* (`https://musicbrainz.org/ws/2/artist?query=<name>&fmt=json`)
- Requires a descriptive `User-Agent` with contact info. Requests without one get blocked.
- Rate limit is roughly 1 req/sec. Serialize calls.
- Take the top-scoring result; if the top score is below ~90, treat the artist as unresolved rather than guessing.

*setlist.fm* (`https://api.setlist.fm/rest/1.0`)
- Headers: `x-api-key: <key>` and `Accept: application/json`. Without the Accept header you get XML.
- `GET /artist/{mbid}/setlists?p=1` — 20 setlists per page, newest first.
- `eventDate` is **`dd-MM-yyyy`**, not ISO. Parse it explicitly; do not pass it to `new Date()`.
- Songs live at `sets.set[].song[]`. A set object may have `encore: 1`. A song may have `tape: true` (walk-on music — exclude it), `cover: {...}`, or `info`.
- Setlists with an empty `sets.set` array are common (someone created the entry but logged no songs). Filter them out before doing any math.
- Verify the current published rate limits during this phase and note them in the README.

**Aggregation rules** (`aggregate.ts`, pure function, unit tested)
- Input: array of setlists. Output: `ArtistAggregate`.
- Consider shows within the last 90 days. If fewer than 5 qualify, widen to 180 days. If still fewer than 5, return `{ status: 'insufficient_data', showCount: n }`.
- Drop shows where the song count is below 5 (festival slots, partial entries) from percentage math, but report how many were dropped.
- For each song: `playRate = showsPlayed / totalShowsConsidered`.
  - `>= 0.85` → `lock`
  - `0.30–0.85` → `rotating`
  - `< 0.30` → `rare`
- Also compute: median song count, whether an encore appears in >50% of shows, and `bustouts` (songs played in the window whose previous appearance was more than 2 years earlier — requires a second, wider query; **defer to Phase 6**, just leave the field out for now).
- Normalize song names for grouping: trim, collapse whitespace, casefold. Keep the most common original casing for display.

**Shared type** (`packages/shared/src/types.ts`)

```ts
export type SongStat = {
  name: string;
  playCount: number;
  playRate: number;         // 0..1
  tier: 'lock' | 'rotating' | 'rare';
  isCover: boolean;
};

export type ArtistAggregate =
  | { status: 'ok';
      mbid: string;
      artistName: string;
      windowDays: number;
      showsConsidered: number;
      showsDropped: number;
      lastShowDate: string;   // ISO
      medianSongCount: number;
      hasEncore: boolean;
      songs: SongStat[];      // sorted by playRate desc
      sourceUrl: string;      // setlist.fm artist page, for attribution
    }
  | { status: 'insufficient_data'; artistName: string; showCount: number }
  | { status: 'artist_not_found'; query: string };
```

**Tasks**
- Save real API responses to `test/fixtures/` for: a heavy toucher (Phish or Dead & Company), a fixed-setlist pop act, an artist with fewer than 5 recent shows, and an artist name that resolves ambiguously.
- Unit test `aggregate.ts` against all four fixtures.
- Secrets via `wrangler secret put SETLISTFM_API_KEY`; local dev via `.dev.vars` (gitignored).

**Acceptance**
- Hitting `/aggregate?artist=...` locally returns sensible JSON for all four fixture artists.
- Tests cover the tier boundaries, the insufficient-data path, and `dd-MM-yyyy` parsing.
- No API key appears anywhere in git history.

**Commits:** `feat(worker): resolve artists via MusicBrainz` · `feat(worker): setlist.fm client` · `feat(worker): setlist aggregation` · `test(worker): fixtures and aggregation tests`

---

### Phase 2 — Worker: caching and hardening

**Goal:** the worker is safe to point a public extension at.

**Tasks**
- KV cache keyed on `agg:v1:{mbid}`, TTL 24h. Include the schema version in the key so a logic change invalidates cleanly.
- Separate, longer-lived cache for name→MBID (`mbid:v1:{normalizedName}`, 30 days) — that mapping almost never changes.
- Serve stale on upstream failure: if the fetch fails but a stale entry exists, return it with `stale: true`.
- CORS headers restricted to `chrome-extension://*` plus localhost for dev.
- Structured error responses; never leak upstream error bodies.
- Basic per-IP throttle so one broken client can't burn your rate limit.
- `GET /aggregate` accepts either `?artist=` or `?mbid=` (the latter skips resolution).

**Acceptance**
- Second request for the same artist returns from cache — verify via a `cached: true` field or a response header.
- Killing upstream (temporarily bad key) still returns a stale result rather than a 500.
- Deployed to Cloudflare; the live URL is recorded in the README.

**Commits:** `feat(worker): KV caching for aggregates and MBIDs` · `feat(worker): stale-on-error and rate limiting`

---

### Phase 3 — Extension: event detection

No UI yet. Prove you can reliably identify what page you're on.

**Goal:** on a Ticketmaster event page, the content script logs `{ artist, date, venue, city }` to the console.

**Approach**
- Primary strategy: parse `<script type="application/ld+json">` blocks, look for `@type: "MusicEvent"` (sometimes nested in an array or a `@graph`). Pull `performer.name`, `startDate`, `location.name`, `location.address.addressLocality`.
- Fallback: DOM selectors, in a clearly separated function marked as brittle, with a comment naming the date it was last verified.
- Ticket pages are SPAs — the event may not be in the DOM at `document_idle`. Use a `MutationObserver` with a timeout (~10s) rather than a fixed delay.
- Adapter interface so site #2 is a new file, not a rewrite:

```ts
export type EventContext = {
  artist: string;
  date: string | null;      // ISO
  venue: string | null;
  city: string | null;
  source: 'jsonld' | 'dom';
};

export interface SiteAdapter {
  matches(url: URL): boolean;
  detect(): Promise<EventContext | null>;
}
```

- Manifest: `content_scripts` matching Ticketmaster event URLs only (not the whole domain), `host_permissions` for your Worker URL only.

**Acceptance**
- Correct detection on 5 different real Ticketmaster event pages, including one multi-artist bill and one non-music event (which must return `null`, not garbage).
- Detection returns `null` cleanly on a Ticketmaster page that isn't an event.
- Console log identifies whether JSON-LD or the DOM fallback was used.

**Commits:** `feat(extension): site adapter interface` · `feat(extension): ticketmaster event detection`

---

### Phase 4 — Extension: the panel

**Goal:** the overlay actually appears with real data.

**Tasks**
- Background service worker owns all fetches. Content script sends `{ type: 'GET_AGGREGATE', artist }` via `chrome.runtime.sendMessage`; the worker fetches and replies. (Content scripts are subject to CORS; the background worker is the standard escape hatch and keeps your endpoint out of page context.)
- In-memory + `chrome.storage.session` cache in the background worker, so navigating between events for the same artist doesn't refetch.
- Content script creates a host element, attaches `attachShadow({ mode: 'open' })`, mounts React inside.
- Panel layout, top to bottom:
  1. Header: artist name, "based on N shows since <date>"
  2. **Locks** — songs at ≥85%, as a simple list
  3. **Rotating** — songs with percentages, sorted desc
  4. Footer: typical set length, encore yes/no, "Data from setlist.fm" link (per the Phase 0 attribution finding)
- Collapsed by default to a small pill; expands on click. Position it fixed bottom-right — do not try to inject into their layout flow.
- States to build explicitly: loading, `insufficient_data`, `artist_not_found`, network error, and stale-data notice.

**Acceptance**
- Panel renders correct data on a real Ticketmaster page for a touring artist.
- Host page styles do not affect the panel; panel styles do not affect the host page.
- Every non-happy state is reachable and legible (force them by stubbing the response).
- Panel is dismissible and stays dismissed for that page load.

**Commits:** `feat(extension): background fetch bridge` · `feat(extension): shadow DOM panel mount` · `feat(extension): aggregate panel UI` · `feat(extension): loading and error states`

---

### Phase 5 — Polish

**Goal:** something you'd hand to a friend.

**Tasks**
- Extension options page: toggle auto-expand, toggle spoiler-free mode (hides song names, shows only set length and encore info).
- Icons at 16/32/48/128, a real name and description in the manifest.
- Panel: skeleton loader instead of a spinner; keyboard-dismissible; `prefers-color-scheme` support.
- Empty-state copy that explains *why* there's no data rather than just failing.
- README with screenshots and load-unpacked instructions.

**Acceptance**
- A fresh Chrome profile can load the extension and get a working panel without any setup.
- Options persist across browser restart.

**Commits:** `feat(extension): options page` · `feat(extension): spoiler-free mode` · `polish(extension): icons, dark mode, skeleton states`

---

### Phase 6 — Second site + bustouts

**Goal:** prove the adapter abstraction, add the feature with the most personality.

**Tasks**
- Add a second adapter. Dice or Bandsintown are cleaner to parse than AXS. Only the adapter file and the manifest match patterns should change — if anything else needs changing, the abstraction was wrong and should be fixed.
- Bustout detection: for songs in the current window, query further back to find the previous appearance; flag gaps over 2 years. Cache separately since it's expensive.
- Surface bustouts as a distinct section — this is the emotionally interesting data and deserves its own visual treatment.

**Acceptance**
- Both sites work from the same build.
- Bustouts verified by hand against setlist.fm for one artist known for deep cuts.

**Commits:** `feat(extension): <site> adapter` · `feat(worker): bustout detection`

---

### Phase 7 — Store readiness

**Goal:** publishable, listed or unlisted.

**Tasks**
- Audit permissions down to the minimum. Every entry in `host_permissions` must be justified in the listing.
- Privacy policy page — required if you touch any user data, and reviewers ask about it regardless. State plainly: artist names are sent to your Worker, nothing else is collected.
- Production build with source maps excluded, zipped.
- Store listing: description, 1280×800 screenshots, small promo tile.
- Verify the Phase 0 attribution requirement is satisfied in the shipped UI.
- Tag `v1.0.0`.

**Commits:** `chore: production build config` · `docs: privacy policy and store listing` · `chore: release v1.0.0`

---

## 4. DEVLOG format

`DEVLOG.md`, newest entry at the top:

```markdown
## Phase N — <name> — YYYY-MM-DD

**Shipped:** one or two sentences on what now works that didn't before.

**Commits:** `abc1234` feat(worker): ... · `def5678` test(worker): ...

**Decisions:** choices made that weren't in the plan, and why.

**Surprises:** anything upstream that behaved differently than documented.
This is the most useful section — write it even when it feels obvious.

**Known gaps:** what's deliberately unfinished, what's fragile, what will
break first.

**Verification:** what was actually tested, and how.
```

---

## 5. Open questions to settle before Phase 1

1. **Extension name.** `setlist-scout` is a placeholder; renaming later touches the manifest, repo, and store listing. — **Settled 2026-09-01: keeping `setlist-scout`.**
2. **Worker domain.** Custom domain or `*.workers.dev`? Affects `host_permissions` and is annoying to change after publishing. — **Settled 2026-09-01: `*.workers.dev`, decided during Phase 0.**
3. **Attribution constraints.** Phase 0 answers this, but if setlist.fm's terms restrict derived/aggregated display, Phases 1 and 4 both change shape. — **Answered in Phase 0, see README. Caching TTL conflict is still open — needs a decision before Phase 2.**
4. **Percentage display.** Raw percentages, or qualitative labels ("almost always", "about half the time")? Percentages read more precise than the data warrants at n=6. — still open.
