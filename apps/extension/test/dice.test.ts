// @vitest-environment jsdom

process.env.TZ = "UTC";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiceAdapter } from "../src/content/adapters/dice";
import diceEventSchema from "./fixtures/dice-event-schema.json";

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

describe("DiceAdapter.matches", () => {
  const adapter = new DiceAdapter();

  it("matches a real dice.fm event URL", () => {
    const url = new URL(
      "https://dice.fm/event/rynlgr-c2c-nyc-2026-8th-may-knockdown-center-new-york-tickets",
    );
    expect(adapter.matches(url)).toBe(true);
  });

  it("does not match a non-event dice.fm page", () => {
    expect(adapter.matches(new URL("https://dice.fm/browse"))).toBe(false);
  });

  it("does not match a different domain, even with /event/ in the path", () => {
    expect(
      adapter.matches(
        new URL("https://www.ticketmaster.com/some-event/event/123"),
      ),
    ).toBe(false);
  });
});

describe("DiceAdapter.detect", () => {
  const adapter = new DiceAdapter();

  it("detects via real JSON-LD immediately, picking the first performer off a multi-artist bill", async () => {
    addJsonLdScript(diceEventSchema);

    const result = await adapter.detect();

    expect(result).toEqual({
      artist: "Arca",
      date: "2026-05-08T23:00:00.000Z",
      venue: "Knockdown Center",
      city: "New York",
      source: "jsonld",
    });
  });

  it("returns null cleanly on a page with no MusicEvent JSON-LD (no DOM fallback for this site)", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = "<div>Not an event page</div>";

    const resultPromise = adapter.detect();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await resultPromise).toBeNull();
  });
});
