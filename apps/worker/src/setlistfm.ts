import { parseSetlistFmDate } from "./date";

const SETLISTFM_BASE = "https://api.setlist.fm/rest/1.0";
const DEFAULT_MAX_PAGES = 10;

export type SetlistFmSong = {
  name: string;
  tape?: boolean;
  cover?: { mbid: string; name: string };
  info?: string;
};

export type SetlistFmSet = {
  name?: string;
  encore?: number;
  song?: SetlistFmSong[];
};

export type SetlistFmSetlist = {
  id: string;
  eventDate: string; // dd-MM-yyyy
  artist: { mbid: string; name: string; url: string };
  sets: { set: SetlistFmSet[] };
};

type SetlistFmPage = {
  itemsPerPage: number;
  page: number;
  total: number;
  setlist: SetlistFmSetlist[];
};

/**
 * Fetches setlists for an artist, newest first, stopping once a page's
 * oldest show falls outside `oldestDate` or there are no more pages. Returns
 * null when setlist.fm has no record of the mbid at all (404 on page 1).
 */
export async function fetchArtistSetlists(
  mbid: string,
  apiKey: string,
  opts: {
    maxPages?: number;
    oldestDate?: Date;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<SetlistFmSetlist[] | null> {
  const { maxPages = DEFAULT_MAX_PAGES, oldestDate, fetchImpl = fetch } = opts;
  const results: SetlistFmSetlist[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchImpl(
      `${SETLISTFM_BASE}/artist/${mbid}/setlists?p=${page}`,
      {
        headers: { "x-api-key": apiKey, Accept: "application/json" },
      },
    );

    if (res.status === 404) {
      return page === 1 ? null : results;
    }
    if (!res.ok) {
      throw new Error(`setlist.fm request failed: ${res.status}`);
    }

    const data = (await res.json()) as SetlistFmPage;
    results.push(...data.setlist);

    const oldestOnPage = data.setlist.at(-1);
    if (!oldestOnPage) break;
    if (data.setlist.length < data.itemsPerPage) break;
    if (oldestDate && parseSetlistFmDate(oldestOnPage.eventDate) < oldestDate)
      break;
  }

  return results;
}
