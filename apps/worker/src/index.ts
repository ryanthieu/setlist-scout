import type { ArtistAggregate } from "@setlist-scout/shared";
import { Hono } from "hono";
import { aggregateSetlists } from "./aggregate";
import { resolveArtist } from "./musicbrainz";
import { fetchArtistSetlists } from "./setlistfm";

type Bindings = {
  SETLISTFM_API_KEY: string;
  CACHE: KVNamespace;
};

const MB_USER_AGENT = "setlist-scout/0.1 (ryanthieu1@gmail.com)";
const AGGREGATE_WINDOW_DAYS = 180;

const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ ok: true }));

app.get("/aggregate", async (c) => {
  const artistQuery = c.req.query("artist");
  if (!artistQuery) {
    return c.json({ error: "missing required query param: artist" }, 400);
  }

  const resolved = await resolveArtist(artistQuery, MB_USER_AGENT);
  if (!resolved) {
    const body: ArtistAggregate = {
      status: "artist_not_found",
      query: artistQuery,
    };
    return c.json(body);
  }

  const oldestDate = new Date(
    Date.now() - AGGREGATE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const setlists = await fetchArtistSetlists(
    resolved.mbid,
    c.env.SETLISTFM_API_KEY,
    { oldestDate },
  );
  if (!setlists) {
    const body: ArtistAggregate = {
      status: "artist_not_found",
      query: artistQuery,
    };
    return c.json(body);
  }

  const sourceUrl =
    setlists[0]?.artist.url ??
    `https://www.setlist.fm/setlists/search?query=${encodeURIComponent(resolved.name)}`;

  const result = aggregateSetlists({
    mbid: resolved.mbid,
    artistName: resolved.name,
    sourceUrl,
    setlists,
  });

  return c.json(result);
});

export default app;
