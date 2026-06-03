import { describe, expect, it, vi } from "vitest";
import { fetchArtistSetlists } from "../src/setlistfm";
import phishP1 from "./fixtures/setlistfm-phish-p1.json";
import phishP2 from "./fixtures/setlistfm-phish-p2.json";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchArtistSetlists", () => {
  it("stops paginating once a page's oldest show falls outside the requested window", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(phishP1))
      .mockResolvedValueOnce(jsonResponse(phishP2)) as unknown as typeof fetch;

    // Phish page 2's oldest show is 16-09-2025; cut off well after that so
    // the fetcher should stop after page 2 without requesting a page 3.
    const oldestDate = new Date("2026-01-01T00:00:00Z");

    const result = await fetchArtistSetlists("mbid", "key", {
      fetchImpl,
      oldestDate,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(
      phishP1.setlist.length + phishP2.setlist.length,
    );
  });

  it("sends the required headers", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(phishP1)) as unknown as typeof fetch;
    await fetchArtistSetlists("mbid", "my-key", { fetchImpl, maxPages: 1 });

    const [, init] = vi.mocked(fetchImpl).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("my-key");
    expect(headers.Accept).toBe("application/json");
  });

  it("returns null when the artist has no setlists on record (404 on page 1)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ code: 404 }, 404),
      ) as unknown as typeof fetch;
    const result = await fetchArtistSetlists("unknown-mbid", "key", {
      fetchImpl,
    });
    expect(result).toBeNull();
  });

  it("stops once maxPages is reached", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(phishP1)) as unknown as typeof fetch;
    await fetchArtistSetlists("mbid", "key", { fetchImpl, maxPages: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
