import { describe, expect, it, vi } from "vitest";
import { resolveArtist } from "../src/musicbrainz";
import kaiserSearch from "./fixtures/musicbrainz-kaiser-ambiguous.json";
import notFoundSearch from "./fixtures/musicbrainz-notfound.json";
import phishSearch from "./fixtures/musicbrainz-phish.json";

function fetchReturning(body: unknown): typeof fetch {
  return vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    ) as unknown as typeof fetch;
}

describe("resolveArtist", () => {
  it("resolves a confident exact-name match", async () => {
    const result = await resolveArtist(
      "Phish",
      "test-agent",
      fetchReturning(phishSearch),
    );
    expect(result).toEqual({
      mbid: "e01646f2-2a04-450d-8bf2-0d993082e058",
      name: "Phish",
      score: 100,
    });
  });

  it("returns null when the search has no results", async () => {
    const result = await resolveArtist(
      "zzxqwvbnotarealartist",
      "test-agent",
      fetchReturning(notFoundSearch),
    );
    expect(result).toBeNull();
  });

  it("resolves confidently to the wrong same-named act rather than guessing between them (known limitation)", async () => {
    // Searching "Kaiser" hoping for Kaiser Chiefs actually resolves to
    // Roland Kaiser at score 100 -- MusicBrainz's search doesn't know the
    // two are different "kinds" of famous, it just matches the string.
    const result = await resolveArtist(
      "Kaiser",
      "test-agent",
      fetchReturning(kaiserSearch),
    );
    expect(result?.name).toBe("Roland Kaiser");
    expect(result?.score).toBe(100);
  });

  it("sends the given User-Agent header", async () => {
    const fetchImpl = fetchReturning(phishSearch);
    await resolveArtist(
      "Phish",
      "setlist-scout/0.1 (test@example.com)",
      fetchImpl,
    );
    const [, init] = vi.mocked(fetchImpl).mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(
      "setlist-scout/0.1 (test@example.com)",
    );
  });
});
