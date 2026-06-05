const WINDOW_SECONDS = 60;
const LIMIT_PER_WINDOW = 30;

/**
 * Fixed-window per-IP request counter backed by KV. This is a basic guard
 * against one broken client burning the shared MusicBrainz/setlist.fm rate
 * limit, not a precise limiter: KV reads/writes aren't atomic, so concurrent
 * requests from the same IP in the same window can race past the limit by a
 * few requests. Good enough for "one client can't hammer us"; not a
 * substitute for a real rate limiter if this ever sees adversarial traffic.
 */
export async function isRateLimited(
  kv: KVNamespace,
  ip: string,
  now: number = Date.now(),
): Promise<boolean> {
  const windowBucket = Math.floor(now / (WINDOW_SECONDS * 1000));
  const key = `throttle:v1:${ip}:${windowBucket}`;

  const current = await kv.get(key);
  const count = current ? Number(current) : 0;
  if (count >= LIMIT_PER_WINDOW) {
    return true;
  }

  await kv.put(key, String(count + 1), { expirationTtl: WINDOW_SECONDS * 2 });
  return false;
}
