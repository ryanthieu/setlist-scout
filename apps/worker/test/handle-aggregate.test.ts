import { describe, expect, it, vi } from "vitest";
import { handleAggregate } from "../src/handle-aggregate";
import type { ResolvedArtist } from "../src/musicbrainz";
import type { SetlistFmSetlist } from "../src/setlistfm";
import { createFakeKv } from "./fake-kv";

const NOW = new Date("2026-09-01T12:00:00.000Z");

function buildSetlists(count: number, dayOffset = 0): SetlistFmSetlist[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    eventDate: `0${((i + dayOffset) % 9) + 1}-08-2026`,
    artist: {
      mbid: "m1",
      name: "Test Artist",
      url: "https://www.setlist.fm/setlists/test-artist.html",
    },
    sets: {
      set: [
        {
          song: Array.from({ length: 6 }, (_, s) => ({ name: `Song ${s}` })),
        },
      ],
    },
  }));
}

function baseInput(
  overrides: Partial<Parameters<typeof handleAggregate>[0]> = {},
) {
  return {
    kv: createFakeKv(),
    apiKey: "test-key",
    userAgent: "test-agent",
    now: NOW,
    ...overrides,
  };
}

describe("handleAggregate", () => {
  it("returns 400 when neither artist nor mbid is given", async () => {
    const result = await handleAggregate(baseInput());
    expect(result.httpStatus).toBe(400);
  });

  it("resolves, aggregates, and caches on a first request", async () => {
    const resolveArtistFn = vi.fn().mockResolvedValue({
      mbid: "m1",
      name: "Test Artist",
      score: 100,
    } as ResolvedArtist);
    const fetchArtistSetlistsFn = vi.fn().mockResolvedValue(buildSetlists(5));

    const result = await handleAggregate(
      baseInput({
        artistQuery: "Test Artist",
        resolveArtistFn,
        fetchArtistSetlistsFn,
      }),
    );

    expect(result.httpStatus).toBe(200);
    expect(result.body).toMatchObject({ status: "ok", cached: false });
  });

  it("serves the second request from cache without calling upstream again", async () => {
    const kv = createFakeKv();
    const resolveArtistFn = vi.fn().mockResolvedValue({
      mbid: "m1",
      name: "Test Artist",
      score: 100,
    } as ResolvedArtist);
    const fetchArtistSetlistsFn = vi.fn().mockResolvedValue(buildSetlists(5));

    await handleAggregate(
      baseInput({
        kv,
        artistQuery: "Test Artist",
        resolveArtistFn,
        fetchArtistSetlistsFn,
      }),
    );
    const second = await handleAggregate(
      baseInput({
        kv,
        artistQuery: "Test Artist",
        resolveArtistFn,
        fetchArtistSetlistsFn,
      }),
    );

    expect(resolveArtistFn).toHaveBeenCalledTimes(1);
    expect(fetchArtistSetlistsFn).toHaveBeenCalledTimes(1);
    expect(second.httpStatus).toBe(200);
    expect(second.body).toMatchObject({ status: "ok", cached: true });
  });

  it("serves a stale aggregate with stale: true when setlist.fm is down but a cached copy exists", async () => {
    const kv = createFakeKv();
    const resolveArtistFn = vi.fn().mockResolvedValue({
      mbid: "m1",
      name: "Test Artist",
      score: 100,
    } as ResolvedArtist);
    const workingFetch = vi.fn().mockResolvedValue(buildSetlists(5));

    await handleAggregate(
      baseInput({
        kv,
        artistQuery: "Test Artist",
        resolveArtistFn,
        fetchArtistSetlistsFn: workingFetch,
      }),
    );

    const failingFetch = vi
      .fn()
      .mockRejectedValue(new Error("setlist.fm is down"));
    const later = new Date(NOW.getTime() + 25 * 60 * 60 * 1000); // past the 24h aggregate freshness window

    const second = await handleAggregate(
      baseInput({
        kv,
        artistQuery: "Test Artist",
        now: later,
        resolveArtistFn,
        fetchArtistSetlistsFn: failingFetch,
      }),
    );

    expect(second.httpStatus).toBe(200);
    expect(second.body).toMatchObject({
      status: "ok",
      cached: true,
      stale: true,
    });
  });

  it("returns 502 upstream_unavailable when setlist.fm is down and there is no cache to fall back on", async () => {
    const resolveArtistFn = vi.fn().mockResolvedValue({
      mbid: "m1",
      name: "Test Artist",
      score: 100,
    } as ResolvedArtist);
    const fetchArtistSetlistsFn = vi.fn().mockRejectedValue(new Error("boom"));

    const result = await handleAggregate(
      baseInput({
        artistQuery: "Test Artist",
        resolveArtistFn,
        fetchArtistSetlistsFn,
      }),
    );

    expect(result.httpStatus).toBe(502);
    expect(result.body).toMatchObject({
      error: { code: "upstream_unavailable" },
    });
  });

  it("falls back to a stale mbid mapping when MusicBrainz is down", async () => {
    const kv = createFakeKv();
    const workingResolve = vi.fn().mockResolvedValue({
      mbid: "m1",
      name: "Test Artist",
      score: 100,
    } as ResolvedArtist);
    const fetchArtistSetlistsFn = vi.fn().mockResolvedValue(buildSetlists(5));

    await handleAggregate(
      baseInput({
        kv,
        artistQuery: "Test Artist",
        resolveArtistFn: workingResolve,
        fetchArtistSetlistsFn,
      }),
    );

    const failingResolve = vi
      .fn()
      .mockRejectedValue(new Error("MusicBrainz is down"));
    // Past the 30-day mbid freshness window, so resolution actually calls
    // (and has to recover from) the failing resolver instead of short-
    // circuiting on a still-fresh cache hit.
    const later = new Date(NOW.getTime() + 31 * 24 * 60 * 60 * 1000);

    const second = await handleAggregate(
      baseInput({
        kv,
        artistQuery: "Test Artist",
        now: later,
        resolveArtistFn: failingResolve,
        fetchArtistSetlistsFn,
      }),
    );

    expect(failingResolve).toHaveBeenCalledTimes(1);
    expect(second.httpStatus).toBe(200);
    expect(second.body).toMatchObject({ status: "ok" });
    // The aggregate cache is also past its (much shorter) freshness window
    // by now, so resolving the stale mbid still leads to a real re-fetch.
    expect(fetchArtistSetlistsFn).toHaveBeenCalledTimes(2);
  });

  it("returns artist_not_found when MusicBrainz has no confident match", async () => {
    const resolveArtistFn = vi.fn().mockResolvedValue(null);
    const result = await handleAggregate(
      baseInput({ artistQuery: "zzxqwv", resolveArtistFn }),
    );

    expect(result.httpStatus).toBe(200);
    expect(result.body).toEqual({
      status: "artist_not_found",
      query: "zzxqwv",
    });
  });

  it("returns artist_not_found when setlist.fm has no record of the mbid", async () => {
    const resolveArtistFn = vi.fn().mockResolvedValue({
      mbid: "m1",
      name: "Test Artist",
      score: 100,
    } as ResolvedArtist);
    const fetchArtistSetlistsFn = vi.fn().mockResolvedValue(null);

    const result = await handleAggregate(
      baseInput({
        artistQuery: "Test Artist",
        resolveArtistFn,
        fetchArtistSetlistsFn,
      }),
    );

    expect(result.body).toEqual({
      status: "artist_not_found",
      query: "Test Artist",
    });
  });

  it("skips MusicBrainz resolution entirely when ?mbid= is given", async () => {
    const resolveArtistFn = vi.fn();
    const fetchArtistSetlistsFn = vi.fn().mockResolvedValue(buildSetlists(5));

    const result = await handleAggregate(
      baseInput({ mbidQuery: "m1", resolveArtistFn, fetchArtistSetlistsFn }),
    );

    expect(resolveArtistFn).not.toHaveBeenCalled();
    expect(result.httpStatus).toBe(200);
    expect(fetchArtistSetlistsFn).toHaveBeenCalledWith(
      "m1",
      "test-key",
      expect.anything(),
    );
  });
});
