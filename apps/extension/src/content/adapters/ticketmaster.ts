import type { EventContext } from "@setlist-scout/shared";
import { detectWithObserver } from "./detect-with-observer";
import { getJsonLdScriptContents } from "./dom-helpers";
import { extractMusicEventFromJsonLd } from "./json-ld";
import type { SiteAdapter } from "./site-adapter";

const EVENT_PATH = /\/event\//;
const TICKETMASTER_HOST = /(^|\.)ticketmaster\.com$/;

// "Sun • Sep 13, 2026 • 8:00 PM" -- bullet-separated day/date/time string
// observed in Ticketmaster's rendered event header.
const DATE_TEXT_PATTERN =
  /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*[•·]\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\s*[•·]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i;

function parseVenueText(text: string): {
  venue: string | null;
  city: string | null;
} {
  // Observed pattern: "Venue Name, City, ST"
  const parts = text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    const city = parts[parts.length - 2] ?? null;
    const venue = parts.slice(0, parts.length - 2).join(", ") || null;
    return { venue, city };
  }
  if (parts.length === 2) {
    return { venue: parts[0] ?? null, city: parts[1] ?? null };
  }
  return { venue: parts[0] ?? null, city: null };
}

function parseDateText(bodyText: string): string | null {
  const match = DATE_TEXT_PATTERN.exec(bodyText);
  const monthDayYear = match?.[1];
  const time = match?.[2];
  if (!monthDayYear || !time) return null;

  const parsed = new Date(`${monthDayYear} ${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * DOM fallback, last verified against a real Ticketmaster event page on
 * 2026-09-01. Ticketmaster's markup uses styled-components hash classes
 * (e.g. "sc-85d93237-7") that rotate on redeploys, so this deliberately
 * avoids class selectors in favor of semantic/structural signals -- still
 * brittle, just not brittle in the "breaks on the next deploy" way.
 */
function extractMusicEventFromDom(doc: Document): EventContext | null {
  const artist = doc.querySelector("h1")?.textContent?.trim();
  if (!artist) return null;

  const venueLink = doc.querySelector<HTMLAnchorElement>('a[href*="/venue/"]');
  const { venue, city } = venueLink?.textContent
    ? parseVenueText(venueLink.textContent)
    : { venue: null, city: null };

  const date = doc.body.textContent
    ? parseDateText(doc.body.textContent)
    : null;

  return { artist, date, venue, city, source: "dom" };
}

export class TicketmasterAdapter implements SiteAdapter {
  matches(url: URL): boolean {
    return (
      TICKETMASTER_HOST.test(url.hostname) && EVENT_PATH.test(url.pathname)
    );
  }

  detect(): Promise<EventContext | null> {
    return detectWithObserver(
      () =>
        extractMusicEventFromJsonLd(getJsonLdScriptContents(document)) ??
        extractMusicEventFromDom(document),
    );
  }
}
