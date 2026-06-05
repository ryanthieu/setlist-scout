// @vitest-environment jsdom

// startDate in real Ticketmaster JSON-LD has no timezone offset, so parsing
// it is timezone-dependent. Pin to UTC so assertions are deterministic.
process.env.TZ = "UTC";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TicketmasterAdapter } from "../src/content/adapters/ticketmaster";
import eventSchema from "./fixtures/ticketmaster-event-schema.json";

function addJsonLdScript(json: unknown): void {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(json);
  document.head.appendChild(script);
}

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TicketmasterAdapter.matches", () => {
  const adapter = new TicketmasterAdapter();

  it("matches a real ticketmaster.com event URL", () => {
    const url = new URL(
      "https://www.ticketmaster.com/chance-the-rapper-coloring-book-10-austin-texas-09-13-2026/event/3A0064ABEAE92935",
    );
    expect(adapter.matches(url)).toBe(true);
  });

  it("does not match a non-event ticketmaster.com page", () => {
    expect(
      adapter.matches(
        new URL("https://www.ticketmaster.com/discover/concerts"),
      ),
    ).toBe(false);
  });

  it("does not match a different domain, even with /event/ in the path", () => {
    expect(
      adapter.matches(new URL("https://www.stubhub.com/some-event/event/123")),
    ).toBe(false);
  });
});

describe("TicketmasterAdapter.detect", () => {
  const adapter = new TicketmasterAdapter();

  it("detects via real JSON-LD immediately, without waiting on the MutationObserver", async () => {
    addJsonLdScript(eventSchema);

    const result = await adapter.detect();

    expect(result).toEqual({
      artist: "Chance The Rapper",
      date: "2026-09-13T20:00:00.000Z",
      venue: "Moody Amphitheater",
      city: "Austin",
      source: "jsonld",
    });
  });

  it("falls back to DOM parsing when no MusicEvent JSON-LD is present", async () => {
    document.body.innerHTML = `
      <h1>Some Artist - Tour Name</h1>
      <span>Sun • Sep 13, 2026 • 8:00 PM</span>
      <a href="https://www.ticketmaster.com/some-venue/venue/123">Moody Amphitheater, Austin, TX</a>
    `;

    const result = await adapter.detect();

    expect(result).toEqual({
      artist: "Some Artist - Tour Name",
      date: "2026-09-13T20:00:00.000Z",
      venue: "Moody Amphitheater",
      city: "Austin",
      source: "dom",
    });
  });

  it("returns null (not garbage) for a non-music event's JSON-LD, after waiting out the observer timeout", async () => {
    vi.useFakeTimers();
    addJsonLdScript({
      "@type": "SportsEvent",
      name: "Home Game",
      performer: { name: "Some Team" },
    });

    const resultPromise = adapter.detect();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await resultPromise).toBeNull();
  });

  it("returns null cleanly on a page with neither JSON-LD nor recognizable DOM structure", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = "<div>Not an event page</div>";

    const resultPromise = adapter.detect();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await resultPromise).toBeNull();
  });

  it("resolves as soon as a mutation makes the JSON-LD available, without waiting for the full timeout", async () => {
    vi.useFakeTimers();

    const resultPromise = adapter.detect();
    await vi.advanceTimersByTimeAsync(1_000);
    addJsonLdScript(eventSchema);

    // Let the MutationObserver's microtask queue flush.
    await vi.advanceTimersByTimeAsync(0);

    expect(await resultPromise).toEqual({
      artist: "Chance The Rapper",
      date: "2026-09-13T20:00:00.000Z",
      venue: "Moody Amphitheater",
      city: "Austin",
      source: "jsonld",
    });
  });
});
