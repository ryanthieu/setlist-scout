import { describe, expect, it } from "vitest";
import {
  AGGREGATE_FRESH_MS,
  getCachedAggregate,
  getCachedMbid,
  isFresh,
  MBID_FRESH_MS,
  normalizeArtistQuery,
  putCachedAggregate,
  putCachedMbid,
} from "../src/cache";
import { createFakeKv } from "./fake-kv";

const SAMPLE_AGGREGATE = {
  status: "ok" as const,
  mbid: "m1",
  artistName: "Test Artist",
  windowDays: 90,
  showsConsidered: 10,
  showsDropped: 0,
  lastShowDate: "2026-08-01T00:00:00.000Z",
  medianSongCount: 16,
  hasEncore: true,
  songs: [],
  sourceUrl: "https://example.com",
};

describe("normalizeArtistQuery", () => {
  it("trims, collapses whitespace, and casefolds", () => {
    expect(normalizeArtistQuery("  The   Strokes ")).toBe("the strokes");
  });
});

describe("isFresh", () => {
  it("is fresh just under the window and stale just over it", () => {
    const timestamp = new Date("2026-08-01T00:00:00.000Z").toISOString();
    const oneHour = 60 * 60 * 1000;
    const justUnder =
      new Date("2026-08-01T00:00:00.000Z").getTime() + oneHour - 1;
    const justOver =
      new Date("2026-08-01T00:00:00.000Z").getTime() + oneHour + 1;
    expect(isFresh(timestamp, oneHour, justUnder)).toBe(true);
    expect(isFresh(timestamp, oneHour, justOver)).toBe(false);
  });
});

describe("aggregate cache", () => {
  it("round-trips a stored aggregate", async () => {
    const kv = createFakeKv();
    const now = new Date("2026-09-01T00:00:00.000Z");
    await putCachedAggregate(kv, "m1", SAMPLE_AGGREGATE, now);

    const cached = await getCachedAggregate(kv, "m1");
    expect(cached?.aggregate).toEqual(SAMPLE_AGGREGATE);
    expect(cached?.fetchedAt).toBe(now.toISOString());
  });

  it("returns null on a miss", async () => {
    const kv = createFakeKv();
    expect(await getCachedAggregate(kv, "unknown")).toBeNull();
  });

  it("is fresh right after writing and stale after the freshness window", async () => {
    const kv = createFakeKv();
    const writtenAt = new Date("2026-09-01T00:00:00.000Z");
    await putCachedAggregate(kv, "m1", SAMPLE_AGGREGATE, writtenAt);
    const cached = await getCachedAggregate(kv, "m1");
    if (!cached) throw new Error("expected a cached entry");

    expect(
      isFresh(cached.fetchedAt, AGGREGATE_FRESH_MS, writtenAt.getTime() + 1000),
    ).toBe(true);
    expect(
      isFresh(
        cached.fetchedAt,
        AGGREGATE_FRESH_MS,
        writtenAt.getTime() + AGGREGATE_FRESH_MS + 1000,
      ),
    ).toBe(false);
  });
});

describe("mbid cache", () => {
  it("round-trips a resolved artist", async () => {
    const kv = createFakeKv();
    const now = new Date("2026-09-01T00:00:00.000Z");
    await putCachedMbid(
      kv,
      "phish",
      { mbid: "m1", name: "Phish", score: 100 },
      now,
    );

    const cached = await getCachedMbid(kv, "phish");
    expect(cached).toEqual({
      resolvedAt: now.toISOString(),
      mbid: "m1",
      name: "Phish",
    });
  });

  it("stays fresh for the full 30-day window", async () => {
    const kv = createFakeKv();
    const writtenAt = new Date("2026-09-01T00:00:00.000Z");
    await putCachedMbid(
      kv,
      "phish",
      { mbid: "m1", name: "Phish", score: 100 },
      writtenAt,
    );
    const cached = await getCachedMbid(kv, "phish");
    if (!cached) throw new Error("expected a cached entry");

    expect(
      isFresh(
        cached.resolvedAt,
        MBID_FRESH_MS,
        writtenAt.getTime() + MBID_FRESH_MS - 1000,
      ),
    ).toBe(true);
    expect(
      isFresh(
        cached.resolvedAt,
        MBID_FRESH_MS,
        writtenAt.getTime() + MBID_FRESH_MS + 1000,
      ),
    ).toBe(false);
  });
});
