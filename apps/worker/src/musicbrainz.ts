const MB_SEARCH_URL = "https://musicbrainz.org/ws/2/artist";
const SCORE_THRESHOLD = 90;

type MusicBrainzArtist = {
  id: string;
  name: string;
  score: number;
};

type MusicBrainzSearchResponse = {
  artists: MusicBrainzArtist[];
};

export type ResolvedArtist = {
  mbid: string;
  name: string;
  score: number;
};

/**
 * Resolves an artist name to a MusicBrainz ID. Returns null when the top
 * match's score is below SCORE_THRESHOLD (or there's no match at all) --
 * MusicBrainz's search is a confident exact-name match or nothing; it does
 * NOT disambiguate between two well-known acts that happen to share a name
 * (e.g. "Kaiser" resolves to Roland Kaiser at score 100, not Kaiser Chiefs).
 */
export async function resolveArtist(
  query: string,
  userAgent: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedArtist | null> {
  const url = new URL(MB_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");

  const res = await fetchImpl(url, {
    headers: { "User-Agent": userAgent },
  });

  if (!res.ok) {
    throw new Error(`MusicBrainz search failed: ${res.status}`);
  }

  const data = (await res.json()) as MusicBrainzSearchResponse;
  const top = data.artists[0];
  if (!top || top.score < SCORE_THRESHOLD) {
    return null;
  }

  return { mbid: top.id, name: top.name, score: top.score };
}
