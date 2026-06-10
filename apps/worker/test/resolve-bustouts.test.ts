import { describe, expect, it, vi } from "vitest";
import { getCachedBustouts, putCachedBustouts } from "../src/cache";
import { resolveBustouts } from "../src/resolve-bustouts";
import type { SetlistFmSetlist } from "../src/setlistfm";
import { createFakeKv } from "./fake-kv";

const NOW = new Date("2026-09-01T00:00:00.000Z");

function setlist(id: string, date: string, song: string): SetlistFmSetlist {
  return {
    id,
    eventDate: date,
    artist: { mbid: "m", name: "Test", url: "https://example.com" },
    sets: { set: [{ song: [{ name: song }] }] },
  };
}

describe("resolveBustouts", () => {
  it("computes and caches bustouts on a cold cache", async () => {
    const kv = createFakeKv();
    const fetchArtistSetlistsFn = vi.fn().mockResolvedValue([
      setlist("w", "01-08-2026", "Deep Cut"), // within the 180-day window
      setlist("o", "01-01-2020", "Deep Cut"), // well before it, >2yr gap
    ]);

    const bustouts = await resolveBustouts(
      "m1",
      kv,
      "key",
      NOW,
      fetchArtistSetlistsFn,
    );

    expect(bustouts).toHaveLength(1);
    expect(bustouts?.[0]?.name).toBe("Deep Cut");

    const cached = await getCachedBustouts(kv, "m1");
    expect(cached?.bustouts).toEqual(bustouts);
  });

  it("serves from cache within the freshness window without fetching again", async () => {
    const kv = createFakeKv();
    await putCachedBustouts(
      kv,
      "m1",
      [
        {
          name: "Cached One",
          comebackDate: "x",
          previousDate: "y",
          gapDays: 999,
        },
      ],
      NOW,
    );

    const fetchArtistSetlistsFn = vi.fn();
    const bustouts = await resolveBustouts(
      "m1",
      kv,
      "key",
      NOW,
      fetchArtistSetlistsFn,
    );

    expect(fetchArtistSetlistsFn).not.toHaveBeenCalled();
    expect(bustouts?.[0]?.name).toBe("Cached One");
  });

  it("recomputes once the cached value is past its freshness window", async () => {
    const kv = createFakeKv();
    await putCachedBustouts(
      kv,
      "m1",
      [{ name: "Old", comebackDate: "x", previousDate: "y", gapDays: 999 }],
      NOW,
    );

    const later = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000); // past the 7-day freshness window
    const fetchArtistSetlistsFn = vi.fn().mockResolvedValue([]);

    const bustouts = await resolveBustouts(
      "m1",
      kv,
      "key",
      later,
      fetchArtistSetlistsFn,
    );

    expect(fetchArtistSetlistsFn).toHaveBeenCalledTimes(1);
    expect(bustouts).toEqual([]);
  });

  it("falls back to a stale cached value when the wider fetch fails", async () => {
    const kv = createFakeKv();
    await putCachedBustouts(
      kv,
      "m1",
      [
        {
          name: "Stale One",
          comebackDate: "x",
          previousDate: "y",
          gapDays: 999,
        },
      ],
      NOW,
    );

    const later = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
    const fetchArtistSetlistsFn = vi
      .fn()
      .mockRejectedValue(new Error("setlist.fm down"));

    const bustouts = await resolveBustouts(
      "m1",
      kv,
      "key",
      later,
      fetchArtistSetlistsFn,
    );

    expect(bustouts?.[0]?.name).toBe("Stale One");
  });

  it("returns undefined when there's no cache and the fetch fails", async () => {
    const kv = createFakeKv();
    const fetchArtistSetlistsFn = vi
      .fn()
      .mockRejectedValue(new Error("setlist.fm down"));

    const bustouts = await resolveBustouts(
      "m1",
      kv,
      "key",
      NOW,
      fetchArtistSetlistsFn,
    );

    expect(bustouts).toBeUndefined();
  });

  it("returns undefined when setlist.fm has no record of the mbid (404)", async () => {
    const kv = createFakeKv();
    const fetchArtistSetlistsFn = vi.fn().mockResolvedValue(null);

    const bustouts = await resolveBustouts(
      "m1",
      kv,
      "key",
      NOW,
      fetchArtistSetlistsFn,
    );

    expect(bustouts).toBeUndefined();
  });
});
