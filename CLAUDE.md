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

## setlist.fm API terms (read in Phase 0)
- Non-commercial use only without contacting setlist.fm for permission.
  "If the primary purpose of your application is to derive revenue, it is
  considered commercial." This extension is free with no monetization, so it
  should qualify, but this hasn't been confirmed with setlist.fm directly.
- Attribution is required wherever setlist.fm data is shown — a visible link
  to the relevant setlist.fm page (not `nofollow`). The panel's footer link
  satisfies this; don't remove it.
- The published terms say only "short periods" of caching are allowed and
  that data should be distributed "immediately upon receipt." The Phase 2
  plan (24h aggregate cache, 30-day MBID cache) likely doesn't fit that
  language literally. This needs a real decision before Phase 2 ships —
  see README for the open flag. Don't silently widen the cache TTL further
  without revisiting this.
