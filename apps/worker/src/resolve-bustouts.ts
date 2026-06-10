import type { Bustout } from "@setlist-scout/shared";
import { flattenSongs } from "./aggregate";
import { detectBustouts } from "./bustouts";
import {
  BUSTOUT_FRESH_MS,
  getCachedBustouts,
  isFresh,
  putCachedBustouts,
} from "./cache";
import { parseSetlistFmDate } from "./date";
import type { fetchArtistSetlists } from "./setlistfm";

const BUSTOUT_LOOKBACK_DAYS = 3 * 365;
// The widest possible aggregate window (see aggregate.ts) -- anything more
// recent than this belongs to "the current tour," not "history."
const BUSTOUT_WINDOW_DAYS = 180;
const BUSTOUT_MAX_PAGES = 20;

/**
 * Best-effort and independently cached from the main aggregate (see
 * BUSTOUT_FRESH_MS in cache.ts) -- this does its own, much wider setlist.fm
 * fetch, which is exactly the "expensive" part the plan calls out. Never
 * throws: on any failure this falls back to whatever's cached, even if
 * stale, or undefined if nothing's ever been computed. Bustouts are a
 * nice-to-have, not worth failing the whole /aggregate response over.
 */
export async function resolveBustouts(
  mbid: string,
  kv: KVNamespace,
  apiKey: string,
  now: Date,
  fetchArtistSetlistsFn: typeof fetchArtistSetlists,
): Promise<Bustout[] | undefined> {
  const cached = await getCachedBustouts(kv, mbid);
  if (cached && isFresh(cached.computedAt, BUSTOUT_FRESH_MS, now.getTime())) {
    return cached.bustouts;
  }

  try {
    const oldestDate = new Date(
      now.getTime() - BUSTOUT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );
    const setlists = await fetchArtistSetlistsFn(mbid, apiKey, {
      oldestDate,
      maxPages: BUSTOUT_MAX_PAGES,
    });
    if (!setlists) return cached?.bustouts;

    const windowCutoff =
      now.getTime() - BUSTOUT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const nonEmpty = setlists.filter((sl) => flattenSongs(sl).length > 0);
    const windowSetlists = nonEmpty.filter(
      (sl) => parseSetlistFmDate(sl.eventDate).getTime() >= windowCutoff,
    );
    const olderSetlists = nonEmpty.filter(
      (sl) => parseSetlistFmDate(sl.eventDate).getTime() < windowCutoff,
    );

    const bustouts = detectBustouts({ windowSetlists, olderSetlists });
    await putCachedBustouts(kv, mbid, bustouts, now);
    return bustouts;
  } catch {
    return cached?.bustouts;
  }
}
