import type { AggregateResponse } from "@setlist-scout/shared";
import { describe, expect, it, vi } from "vitest";
import { handleGetAggregate } from "../src/background/handle-get-aggregate";

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

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function noopCache() {
  return {
    cacheGet: vi.fn(async () => undefined),
    cacheSet: vi.fn(async () => undefined),
  };
}

describe("handleGetAggregate", () => {
  it("returns the cached value without calling fetch", async () => {
    const cacheGet = vi.fn(async () => SAMPLE);
    const cacheSet = vi.fn(async () => undefined);
    const fetchImpl = vi.fn();

    const result = await handleGetAggregate("Test Artist", {
      cacheGet,
      cacheSet,
      fetchImpl,
      workerUrl: "http://x",
    });

    expect(result).toEqual({ ok: true, data: SAMPLE });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fetches from the worker and caches the result on a miss", async () => {
    const { cacheGet, cacheSet } = noopCache();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(SAMPLE));

    const result = await handleGetAggregate("Test Artist", {
      cacheGet,
      cacheSet,
      fetchImpl,
      workerUrl: "http://worker.local",
    });

    expect(result).toEqual({ ok: true, data: SAMPLE });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://worker.local/aggregate?artist=Test%20Artist",
    );
    expect(cacheSet).toHaveBeenCalledWith("Test Artist", SAMPLE);
  });

  it("returns a network_error result when fetch throws, without caching anything", async () => {
    const { cacheGet, cacheSet } = noopCache();
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await handleGetAggregate("Test Artist", {
      cacheGet,
      cacheSet,
      fetchImpl,
      workerUrl: "http://worker.local",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "network_error",
        message: "Could not reach Setlist Scout's server.",
      },
    });
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("returns a worker_error result on a non-2xx response, without caching it", async () => {
    const { cacheGet, cacheSet } = noopCache();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));

    const result = await handleGetAggregate("Test Artist", {
      cacheGet,
      cacheSet,
      fetchImpl,
      workerUrl: "http://worker.local",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "worker_error",
        message: "Setlist Scout's server returned an error (500).",
      },
    });
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("returns worker_not_configured when there is no worker URL, without attempting a fetch", async () => {
    const { cacheGet, cacheSet } = noopCache();
    const fetchImpl = vi.fn();

    const result = await handleGetAggregate("Test Artist", {
      cacheGet,
      cacheSet,
      fetchImpl,
      workerUrl: "",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "worker_not_configured",
        message: "Setlist Scout's server isn't configured yet.",
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
