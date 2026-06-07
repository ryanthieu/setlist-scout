import type { AggregateResponse } from "@setlist-scout/shared";
import { normalizeArtistQuery } from "@setlist-scout/shared";

const STORAGE_PREFIX = "aggregate:v1:";

// In-memory first: avoids an async chrome.storage round-trip for repeat
// lookups within the same service worker lifetime. chrome.storage.session
// backs it up across service worker restarts within the browser session --
// it's cleared when the browser closes, which is exactly the "don't refetch
// while navigating between events this session" lifetime this needs. This
// is deliberately not the same cache as the worker's 24h KV cache -- that
// one governs data freshness; this one just avoids redundant round-trips.
const memoryCache = new Map<string, AggregateResponse>();

function storageKey(normalizedArtist: string): string {
  return `${STORAGE_PREFIX}${normalizedArtist}`;
}

export async function getCachedAggregate(
  artist: string,
): Promise<AggregateResponse | undefined> {
  const key = normalizeArtistQuery(artist);

  const inMemory = memoryCache.get(key);
  if (inMemory) return inMemory;

  const stored = (await chrome.storage.session.get(storageKey(key)))[
    storageKey(key)
  ] as AggregateResponse | undefined;
  if (stored) memoryCache.set(key, stored);
  return stored;
}

export async function setCachedAggregate(
  artist: string,
  value: AggregateResponse,
): Promise<void> {
  const key = normalizeArtistQuery(artist);
  memoryCache.set(key, value);
  await chrome.storage.session.set({ [storageKey(key)]: value });
}
