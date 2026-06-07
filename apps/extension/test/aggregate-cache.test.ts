import type { AggregateResponse } from "@setlist-scout/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

function createFakeChromeStorageSession() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) =>
      store.has(key) ? { [key]: store.get(key) } : {},
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) store.set(k, v);
    }),
  };
}

const SAMPLE: AggregateResponse = {
  status: "ok",
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

beforeEach(() => {
  vi.stubGlobal("chrome", {
    storage: { session: createFakeChromeStorageSession() },
  });
  vi.resetModules();
});

describe("aggregate-cache", () => {
  it("returns undefined on a miss", async () => {
    const { getCachedAggregate } = await import(
      "../src/background/aggregate-cache"
    );
    expect(await getCachedAggregate("Some Artist")).toBeUndefined();
  });

  it("round-trips a value through chrome.storage.session", async () => {
    const { getCachedAggregate, setCachedAggregate } = await import(
      "../src/background/aggregate-cache"
    );
    await setCachedAggregate("Some Artist", SAMPLE);
    expect(await getCachedAggregate("Some Artist")).toEqual(SAMPLE);
  });

  it("normalizes the artist name for both reads and writes", async () => {
    const { getCachedAggregate, setCachedAggregate } = await import(
      "../src/background/aggregate-cache"
    );
    await setCachedAggregate("  Some   Artist ", SAMPLE);
    expect(await getCachedAggregate("some artist")).toEqual(SAMPLE);
  });

  it("serves subsequent reads from the in-memory cache without hitting chrome.storage.session again", async () => {
    const { getCachedAggregate, setCachedAggregate } = await import(
      "../src/background/aggregate-cache"
    );
    const chromeMock = (
      globalThis as unknown as {
        chrome: { storage: { session: { get: ReturnType<typeof vi.fn> } } };
      }
    ).chrome;

    await setCachedAggregate("Some Artist", SAMPLE);
    await getCachedAggregate("Some Artist");
    await getCachedAggregate("Some Artist");

    expect(chromeMock.storage.session.get).not.toHaveBeenCalled();
  });
});
