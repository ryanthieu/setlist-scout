import type { ArtistAggregate } from "@setlist-scout/shared";
import { normalizeArtistQuery } from "@setlist-scout/shared";
import type { ResolvedArtist } from "./musicbrainz";

export { normalizeArtistQuery };

const CACHE_VERSION = "v1";

// Logical freshness windows: how long a cached value is served without
// hitting upstream at all.
export const AGGREGATE_FRESH_MS = 24 * 60 * 60 * 1000;
export const MBID_FRESH_MS = 30 * 24 * 60 * 60 * 1000;

// Physical KV expirationTtl: deliberately longer than the freshness window
// above, so a value past its "fresh" window is still around to serve as a
// stale fallback if upstream is down, instead of KV deleting it outright.
const AGGREGATE_PHYSICAL_TTL_SECONDS = 30 * 24 * 60 * 60;
const MBID_PHYSICAL_TTL_SECONDS = 90 * 24 * 60 * 60;

export type CachedAggregate = { fetchedAt: string; aggregate: ArtistAggregate };
export type CachedMbid = { resolvedAt: string; mbid: string; name: string };

function aggregateKey(mbid: string): string {
  return `agg:${CACHE_VERSION}:${mbid}`;
}

function mbidKey(normalizedName: string): string {
  return `mbid:${CACHE_VERSION}:${normalizedName}`;
}

export function isFresh(
  isoTimestamp: string,
  freshMs: number,
  now: number,
): boolean {
  return now - new Date(isoTimestamp).getTime() < freshMs;
}

export async function getCachedAggregate(
  kv: KVNamespace,
  mbid: string,
): Promise<CachedAggregate | null> {
  const raw = await kv.get(aggregateKey(mbid));
  return raw ? (JSON.parse(raw) as CachedAggregate) : null;
}

export async function putCachedAggregate(
  kv: KVNamespace,
  mbid: string,
  aggregate: ArtistAggregate,
  now: Date,
): Promise<void> {
  const value: CachedAggregate = { fetchedAt: now.toISOString(), aggregate };
  await kv.put(aggregateKey(mbid), JSON.stringify(value), {
    expirationTtl: AGGREGATE_PHYSICAL_TTL_SECONDS,
  });
}

export async function getCachedMbid(
  kv: KVNamespace,
  normalizedName: string,
): Promise<CachedMbid | null> {
  const raw = await kv.get(mbidKey(normalizedName));
  return raw ? (JSON.parse(raw) as CachedMbid) : null;
}

export async function putCachedMbid(
  kv: KVNamespace,
  normalizedName: string,
  resolved: ResolvedArtist,
  now: Date,
): Promise<void> {
  const value: CachedMbid = {
    resolvedAt: now.toISOString(),
    mbid: resolved.mbid,
    name: resolved.name,
  };
  await kv.put(mbidKey(normalizedName), JSON.stringify(value), {
    expirationTtl: MBID_PHYSICAL_TTL_SECONDS,
  });
}
