# Chrome Web Store listing — Setlist Scout

Draft copy for the store listing form. Assets referenced below live in
`store-assets/`.

## Name

Setlist Scout

## Short description (max 132 characters)

See what an artist actually plays live before you buy the ticket.

(131 characters)

## Detailed description

Buying a ticket without knowing what you're actually going to hear?
Setlist Scout overlays real setlist data from setlist.fm right on the
ticket page, so you know before you buy:

- **Locks** — songs this artist has played at nearly every show this tour
- **Rotating** — songs that show up sometimes, with how often
- **Bustouts** — deep cuts that just came back into rotation after years
  away
- Typical set length and whether to expect an encore

Works on Ticketmaster and Dice event pages. Click the small pill in the
bottom-right corner to expand the panel; dismiss it any time.

**Privacy:** the only thing this extension sends anywhere is the artist
name from the page you're viewing, so it can look up their setlist
history. No accounts, no tracking, no ads. Full privacy policy:
[link to hosted PRIVACY.md].

**Data source:** setlist data comes from the generous, community-run
[setlist.fm](https://www.setlist.fm) database. If you're not seeing data
for a show, it's because setlist.fm doesn't have it yet — consider
contributing your own setlists there after the show.

This is a free, independent project with no affiliation to Ticketmaster,
Dice, or setlist.fm.

## Category

Productivity, or Fun (Chrome Web Store's closest fits — no "Music" or
"Live Events" category exists as of this writing; re-check at actual
submission time since the category list changes).

## Language

English (United States)

## Privacy practices disclosure (required form field)

- Does this extension collect or use user data? **Yes.**
- What: the artist name parsed from the current page.
- Purpose: single, stated purpose — sending it to Setlist Scout's own
  backend to fetch that artist's setlist history.
- Not sold to third parties. Not used for purposes unrelated to the
  extension's core function. Not used to determine creditworthiness or
  for lending purposes. (All standard "no" answers on the CWS data-use
  disclosure form.)
- Privacy policy URL: https://github.com/ryanthieu/setlist-scout/blob/main/PRIVACY.md

## Assets

| Asset | Size | Status |
|---|---|---|
| Store icon | 128×128 | Done — `apps/extension/public/icons/icon-128.png` |
| Small promo tile | 440×280 | Done — `store-assets/promo-tile-440x280.png` |
| Screenshots | 1280×800 (or 640×400), 1–5 required | **Not done** — see below |
| Marquee promo tile | 1400×560 | Not done (optional) |

## Known gaps — do not submit until these are resolved

- ~~The worker isn't deployed~~ **Resolved 2026-09-02.** Live at
  `https://setlist-scout-worker.ryanthieu1.workers.dev`; the extension's
  production build points at it.
- ~~No privacy policy URL~~ **Resolved 2026-09-02.** The repo is now
  public at https://github.com/ryanthieu/setlist-scout, so
  `PRIVACY.md` renders at
  https://github.com/ryanthieu/setlist-scout/blob/main/PRIVACY.md — a
  real, reachable URL. Good enough for an unlisted/personal submission;
  worth a dedicated hosted page (e.g. off the worker's own domain) if
  this ever goes for a public listing.
- **No real screenshots.** Chrome Web Store screenshots need to show the
  actual running extension on a real page in a real browser, which this
  dev environment can't produce (same limitation noted in DEVLOG Phases
  3–6 for visual verification generally). Someone with a browser needs
  to load the unpacked extension, visit a live Ticketmaster or Dice event
  page for a touring artist, and capture the panel in both collapsed and
  expanded states. This is now the only remaining blocker.
