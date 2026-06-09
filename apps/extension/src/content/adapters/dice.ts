import type { EventContext } from "@setlist-scout/shared";
import { detectWithObserver } from "./detect-with-observer";
import { getJsonLdScriptContents } from "./dom-helpers";
import { extractMusicEventFromJsonLd } from "./json-ld";
import type { SiteAdapter } from "./site-adapter";

const EVENT_PATH = /\/event\//;
const DICE_HOST = /(^|\.)dice\.fm$/;

/**
 * No DOM fallback here -- unlike Ticketmaster, real Dice event pages
 * reliably carry a MusicEvent JSON-LD script (server-rendered), so there's
 * nothing brittle to fall back to yet. Add one if that ever proves wrong.
 */
export class DiceAdapter implements SiteAdapter {
  matches(url: URL): boolean {
    return DICE_HOST.test(url.hostname) && EVENT_PATH.test(url.pathname);
  }

  detect(): Promise<EventContext | null> {
    return detectWithObserver(() =>
      extractMusicEventFromJsonLd(getJsonLdScriptContents(document)),
    );
  }
}
