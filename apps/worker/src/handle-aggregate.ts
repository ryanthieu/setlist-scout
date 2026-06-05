import type { ArtistAggregate } from "@setlist-scout/shared";
import { aggregateSetlists } from "./aggregate";
import {
  AGGREGATE_FRESH_MS,
  getCachedAggregate,
  getCachedMbid,
  isFresh,
  MBID_FRESH_MS,
  normalizeArtistQuery,
  putCachedAggregate,
  putCachedMbid,
} from "./cache";
import { resolveArtist } from "./musicbrainz";
import { fetchArtistSetlists } from "./setlistfm";

const SETLIST_WINDOW_DAYS = 180;

export type AggregateResponseBody = ArtistAggregate & {
  cached?: boolean;
  stale?: boolean;
};

export type HandleAggregateResult =
  | { httpStatus: 200; body: AggregateResponseBody }
  | {
      httpStatus: 400 | 502;
      body: { error: { code: string; message: string } };
    };

export type HandleAggregateInput = {
  artistQuery?: string;
  mbidQuery?: string;
  kv: KVNamespace;
  apiKey: string;
  userAgent: string;
  now?: Date;
  resolveArtistFn?: typeof resolveArtist;
  fetchArtistSetlistsFn?: typeof fetchArtistSetlists;
};

type MbidResolution =
  | { status: "resolved"; mbid: string; name?: string }
  | { status: "not_found" }
  | { status: "upstream_unavailable" };

async function resolveMbid(
  artist: string,
  kv: KVNamespace,
  userAgent: string,
  now: Date,
  resolveArtistFn: typeof resolveArtist,
): Promise<MbidResolution> {
  const normalized = normalizeArtistQuery(artist);
  const cached = await getCachedMbid(kv, normalized);

  if (cached && isFresh(cached.resolvedAt, MBID_FRESH_MS, now.getTime())) {
    return { status: "resolved", mbid: cached.mbid, name: cached.name };
  }

  try {
    const resolved = await resolveArtistFn(artist, userAgent);
    if (!resolved) {
      return { status: "not_found" };
    }
    await putCachedMbid(kv, normalized, resolved, now);
    return { status: "resolved", mbid: resolved.mbid, name: resolved.name };
  } catch {
    if (cached) {
      return { status: "resolved", mbid: cached.mbid, name: cached.name };
    }
    return { status: "upstream_unavailable" };
  }
}

type AggregateResolution =
  | { status: "ok"; body: AggregateResponseBody }
  | { status: "upstream_unavailable" };

async function resolveAggregateForMbid(
  mbid: string,
  artistNameHint: string,
  kv: KVNamespace,
  apiKey: string,
  now: Date,
  fetchArtistSetlistsFn: typeof fetchArtistSetlists,
): Promise<AggregateResolution> {
  const cached = await getCachedAggregate(kv, mbid);
  if (cached && isFresh(cached.fetchedAt, AGGREGATE_FRESH_MS, now.getTime())) {
    return { status: "ok", body: { ...cached.aggregate, cached: true } };
  }

  const oldestDate = new Date(
    now.getTime() - SETLIST_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  try {
    const setlists = await fetchArtistSetlistsFn(mbid, apiKey, { oldestDate });
    if (setlists === null) {
      return {
        status: "ok",
        body: { status: "artist_not_found", query: artistNameHint },
      };
    }

    const sourceUrl =
      setlists[0]?.artist.url ??
      `https://www.setlist.fm/search?query=${encodeURIComponent(artistNameHint)}`;
    const result = aggregateSetlists({
      mbid,
      artistName: setlists[0]?.artist.name ?? artistNameHint,
      sourceUrl,
      setlists,
      now,
    });
    await putCachedAggregate(kv, mbid, result, now);
    return { status: "ok", body: { ...result, cached: false } };
  } catch {
    if (cached) {
      return {
        status: "ok",
        body: { ...cached.aggregate, cached: true, stale: true },
      };
    }
    return { status: "upstream_unavailable" };
  }
}

export async function handleAggregate(
  input: HandleAggregateInput,
): Promise<HandleAggregateResult> {
  const {
    artistQuery,
    mbidQuery,
    kv,
    apiKey,
    userAgent,
    now = new Date(),
    resolveArtistFn = resolveArtist,
    fetchArtistSetlistsFn = fetchArtistSetlists,
  } = input;

  if (!artistQuery && !mbidQuery) {
    return {
      httpStatus: 400,
      body: {
        error: {
          code: "missing_query",
          message: "Provide either ?artist= or ?mbid=.",
        },
      },
    };
  }

  let mbid: string;
  let artistNameHint: string;

  if (mbidQuery) {
    mbid = mbidQuery;
    artistNameHint = mbidQuery;
  } else {
    const artist = artistQuery as string;
    const resolution = await resolveMbid(
      artist,
      kv,
      userAgent,
      now,
      resolveArtistFn,
    );

    if (resolution.status === "not_found") {
      return {
        httpStatus: 200,
        body: { status: "artist_not_found", query: artist },
      };
    }
    if (resolution.status === "upstream_unavailable") {
      return {
        httpStatus: 502,
        body: {
          error: {
            code: "upstream_unavailable",
            message: "Could not reach MusicBrainz right now.",
          },
        },
      };
    }

    mbid = resolution.mbid;
    artistNameHint = resolution.name ?? artist;
  }

  const aggregateResolution = await resolveAggregateForMbid(
    mbid,
    artistNameHint,
    kv,
    apiKey,
    now,
    fetchArtistSetlistsFn,
  );

  if (aggregateResolution.status === "upstream_unavailable") {
    return {
      httpStatus: 502,
      body: {
        error: {
          code: "upstream_unavailable",
          message: "Could not reach setlist.fm right now.",
        },
      },
    };
  }

  return { httpStatus: 200, body: aggregateResolution.body };
}
