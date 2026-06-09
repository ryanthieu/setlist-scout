// startDate in real Ticketmaster JSON-LD has no timezone offset (e.g.
// "2026-09-13T20:00"), so parsing it is timezone-dependent. Pin to UTC so
// these assertions don't depend on the machine running them.
process.env.TZ = "UTC";

import { describe, expect, it } from "vitest";
import { extractMusicEventFromJsonLd } from "../src/content/adapters/json-ld";
import diceEventSchema from "./fixtures/dice-event-schema.json";
import breadcrumbSchema from "./fixtures/ticketmaster-breadcrumb-schema.json";
import eventSchema from "./fixtures/ticketmaster-event-schema.json";

describe("extractMusicEventFromJsonLd", () => {
  it("extracts a MusicEvent from a real Ticketmaster event page, picking the headliner", () => {
    const scripts = [
      JSON.stringify(breadcrumbSchema),
      JSON.stringify(eventSchema),
    ];
    const result = extractMusicEventFromJsonLd(scripts);

    expect(result).toEqual({
      artist: "Chance The Rapper",
      date: "2026-09-13T20:00:00.000Z",
      venue: "Moody Amphitheater",
      city: "Austin",
      source: "jsonld",
    });
  });

  it("finds the MusicEvent regardless of script order", () => {
    const scripts = [
      JSON.stringify(eventSchema),
      JSON.stringify(breadcrumbSchema),
    ];
    expect(extractMusicEventFromJsonLd(scripts)?.artist).toBe(
      "Chance The Rapper",
    );
  });

  it("returns null when no script is a MusicEvent (e.g. a non-music event page)", () => {
    const sportsEvent = {
      "@type": "SportsEvent",
      name: "Home Game",
      performer: { name: "Some Team" },
    };
    const scripts = [
      JSON.stringify(breadcrumbSchema),
      JSON.stringify(sportsEvent),
    ];
    expect(extractMusicEventFromJsonLd(scripts)).toBeNull();
  });

  it("returns null when there are no JSON-LD scripts at all", () => {
    expect(extractMusicEventFromJsonLd([])).toBeNull();
  });

  it("skips malformed JSON instead of throwing", () => {
    const scripts = ["{not valid json", JSON.stringify(eventSchema)];
    expect(extractMusicEventFromJsonLd(scripts)?.artist).toBe(
      "Chance The Rapper",
    );
  });

  it("handles a MusicEvent nested under @graph", () => {
    const graphWrapped = {
      "@context": "http://schema.org",
      "@graph": [breadcrumbSchema, eventSchema],
    };
    expect(
      extractMusicEventFromJsonLd([JSON.stringify(graphWrapped)])?.artist,
    ).toBe("Chance The Rapper");
  });

  it("accepts the standard singular schema.org 'performer' key too, not just Ticketmaster's 'performers'", () => {
    const standard = {
      "@type": "MusicEvent",
      startDate: "2026-01-01T20:00",
      performer: { name: "Solo Artist", "@type": "MusicGroup" },
      location: {
        name: "Some Venue",
        address: { addressLocality: "Some City" },
      },
    };
    expect(extractMusicEventFromJsonLd([JSON.stringify(standard)])).toEqual({
      artist: "Solo Artist",
      date: "2026-01-01T20:00:00.000Z",
      venue: "Some Venue",
      city: "Some City",
      source: "jsonld",
    });
  });

  it("returns null when a MusicEvent has no resolvable performer name", () => {
    const noPerformer = {
      "@type": "MusicEvent",
      startDate: "2026-01-01T20:00",
    };
    expect(
      extractMusicEventFromJsonLd([JSON.stringify(noPerformer)]),
    ).toBeNull();
  });

  it("returns null date/venue/city when those fields are missing, without failing the whole extraction", () => {
    const minimal = {
      "@type": "MusicEvent",
      performers: [{ name: "Solo Artist" }],
    };
    expect(extractMusicEventFromJsonLd([JSON.stringify(minimal)])).toEqual({
      artist: "Solo Artist",
      date: null,
      venue: null,
      city: null,
      source: "jsonld",
    });
  });

  it("extracts a MusicEvent from a real Dice event page, including an array-valued location", () => {
    // Dice's real JSON-LD uses the standard singular "performer" key (an
    // array of 13, a full festival lineup) and, unlike Ticketmaster,
    // location is itself an array of Place objects (this venue has multiple
    // rooms) -- take the first. startDate also carries a real timezone
    // offset here, unlike Ticketmaster's bare local-time string.
    const result = extractMusicEventFromJsonLd([
      JSON.stringify(diceEventSchema),
    ]);
    expect(result).toEqual({
      artist: "Arca",
      date: "2026-05-08T23:00:00.000Z",
      venue: "Knockdown Center",
      city: "New York",
      source: "jsonld",
    });
  });
});
