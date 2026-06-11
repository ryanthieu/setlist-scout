# Privacy Policy — Setlist Scout

Last updated: 2026-09-02

Setlist Scout is a Chrome extension that shows what an artist has actually
been playing on tour, on top of ticket purchase pages.

## What data is collected

**The artist name detected on the page you're viewing is sent to Setlist
Scout's own backend server**, so it can look up that artist's recent
setlists on [setlist.fm](https://www.setlist.fm) and send back the result.
That's the only data this extension sends anywhere.

Specifically:

- **What's sent:** the artist name parsed from the ticket page (e.g.
  "Phish"), and, incidentally, your IP address as a normal part of any
  network request (used only for basic abuse-prevention rate limiting on
  the server — see below — never stored against the artist name or
  logged for any other purpose).
- **What's never sent or collected:** your name, email, browsing history,
  which ticket page you were on, purchase or payment information, or any
  other identifying information. The extension does not use analytics,
  tracking pixels, or third-party scripts of any kind.
- **Where it's sent:** Setlist Scout's own Cloudflare Worker backend,
  which the extension talks to directly. That backend calls
  [MusicBrainz](https://musicbrainz.org) and
  [setlist.fm](https://www.setlist.fm)'s public APIs on your behalf and
  caches the aggregated result; it does not forward your IP address or
  any other request data to either of those services beyond what's
  needed to look up the artist.

## What's stored locally

Your two extension settings (auto-expand, spoiler-free mode) are stored
in Chrome's local extension storage (`chrome.storage.local`) on your own
device. This never leaves your machine and isn't accessible to Setlist
Scout's backend or anyone else.

## No accounts, no ads, no selling data

Setlist Scout has no user accounts, no login, no advertising, and does
not sell or share data with third parties. It is a free, non-commercial
personal project.

## Changes to this policy

If this policy changes, the updated version will be posted here with a
new "Last updated" date.

## Contact

Questions about this policy can be directed to the maintainer via the
project's repository.
