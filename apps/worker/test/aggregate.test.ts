import { describe, expect, it } from "vitest";
import { aggregateSetlists } from "../src/aggregate";
import type { SetlistFmSetlist } from "../src/setlistfm";
import oliviaP1 from "./fixtures/setlistfm-oliviarodrigo-p1.json";
import phishP1 from "./fixtures/setlistfm-phish-p1.json";
import phishP2 from "./fixtures/setlistfm-phish-p2.json";
import taylorP1 from "./fixtures/setlistfm-taylorswift-p1.json";

// Fixtures were fetched from the live setlist.fm API on 2026-09-01; this
// mirrors that moment so the 90/180-day windowing math is exercised the same
// way it was validated by hand.
const NOW = new Date("2026-09-01T23:59:59Z");

const phishSetlists = [
  ...phishP1.setlist,
  ...phishP2.setlist,
] as SetlistFmSetlist[];
const oliviaSetlists = oliviaP1.setlist as SetlistFmSetlist[];
const taylorSetlists = taylorP1.setlist as SetlistFmSetlist[];

describe("aggregateSetlists", () => {
  it("finds no locks for a heavy toucher with an 18-show, wide-open rotation (Phish)", () => {
    const result = aggregateSetlists({
      mbid: "e01646f2-2a04-450d-8bf2-0d993082e058",
      artistName: "Phish",
      sourceUrl: "https://www.setlist.fm/setlists/phish-13d6ad51.html",
      setlists: phishSetlists,
      now: NOW,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");

    expect(result.windowDays).toBe(90);
    expect(result.showsConsidered).toBe(18);
    expect(result.showsDropped).toBe(0);
    expect(result.medianSongCount).toBe(16);
    expect(result.hasEncore).toBe(true);
    expect(result.lastShowDate).toBe("2026-08-01T00:00:00.000Z");

    // 18 shows of constant rotation: nothing clears the 0.85 lock bar, and
    // nothing even clears 0.30 rotating -- every song sits in "rare".
    expect(result.songs.every((s) => s.tier === "rare")).toBe(true);
    expect(result.songs[0]?.playRate).toBeCloseTo(4 / 18);
    // sorted by playRate desc
    for (let i = 1; i < result.songs.length; i++) {
      expect(result.songs[i - 1]?.playRate).toBeGreaterThanOrEqual(
        result.songs[i]?.playRate ?? 0,
      );
    }
  });

  it("finds locks and drops low-song-count shows for a fixed-setlist pop act (Olivia Rodrigo)", () => {
    const result = aggregateSetlists({
      mbid: "6925db17-f35e-42f3-a4eb-84ee6bf5d4b0",
      artistName: "Olivia Rodrigo",
      sourceUrl: "https://www.setlist.fm/setlists/olivia-rodrigo.html",
      setlists: oliviaSetlists,
      now: NOW,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");

    expect(result.windowDays).toBe(90);
    // 6 shows fall in the 90-day window; 2 (1 song each) get dropped.
    expect(result.showsConsidered).toBe(4);
    expect(result.showsDropped).toBe(2);
    expect(result.hasEncore).toBe(false);
    expect(result.lastShowDate).toBe("2026-08-29T00:00:00.000Z");

    const byName = new Map(result.songs.map((s) => [s.name.toLowerCase(), s]));

    expect(byName.get("the cure")?.tier).toBe("lock");
    expect(byName.get("the cure")?.playRate).toBe(1);
    expect(byName.get("good 4 u")?.tier).toBe("rotating");
    expect(byName.get("less")?.tier).toBe("rotating");
    expect(byName.get("serena joy")?.tier).toBe("rare");

    // Landslide is logged as a Fleetwood Mac cover in the fixture.
    const landslide = byName.get("landslide");
    expect(landslide?.isCover).toBe(true);
    expect(landslide?.tier).toBe("rare");
  });

  it("returns insufficient_data when too few shows fall in the window even after widening (Taylor Swift)", () => {
    const result = aggregateSetlists({
      mbid: "20244d07-534f-4eff-b4d4-930878889970",
      artistName: "Taylor Swift",
      sourceUrl: "https://www.setlist.fm/setlists/taylor-swift.html",
      setlists: taylorSetlists,
      now: NOW,
    });

    expect(result).toEqual({
      status: "insufficient_data",
      artistName: "Taylor Swift",
      showCount: 3,
    });
  });

  it("excludes tape (walk-on music) from song stats", () => {
    const base: SetlistFmSetlist = {
      id: "1",
      eventDate: "01-08-2026",
      artist: { mbid: "m", name: "Test Artist", url: "https://example.com" },
      sets: {
        set: [
          {
            song: [
              { name: "Intro Tape", tape: true },
              { name: "Real Song 1" },
              { name: "Real Song 2" },
              { name: "Real Song 3" },
              { name: "Real Song 4" },
              { name: "Real Song 5" },
            ],
          },
        ],
      },
    };

    const setlists = Array.from({ length: 5 }, (_, i) => ({
      ...base,
      id: String(i),
      eventDate: `0${i + 1}-08-2026`,
    }));

    const result = aggregateSetlists({
      mbid: "m",
      artistName: "Test Artist",
      sourceUrl: "https://example.com",
      setlists,
      now: NOW,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.songs.some((s) => s.name === "Intro Tape")).toBe(false);
    expect(result.songs).toHaveLength(5);
  });

  describe("tier boundaries", () => {
    function buildSetlists(
      playCounts: number[],
      totalShows: number,
    ): SetlistFmSetlist[] {
      return Array.from({ length: totalShows }, (_, showIndex) => ({
        id: String(showIndex),
        eventDate: `${String((showIndex % 28) + 1).padStart(2, "0")}-08-2026`,
        artist: {
          mbid: "m",
          name: "Boundary Test",
          url: "https://example.com",
        },
        sets: {
          set: [
            {
              song: playCounts
                .map((count, songIndex) => ({ count, songIndex }))
                .filter(({ count }) => count > showIndex)
                .map(({ songIndex }) => ({ name: `Song ${songIndex}` }))
                .concat(
                  // pad every show to >= 5 songs so none get dropped
                  Array.from({ length: 5 }, (_, i) => ({
                    name: `Filler ${i}`,
                  })),
                ),
            },
          ],
        },
      }));
    }

    it("classifies exactly 0.85 as lock and just under as rotating", () => {
      // 20 shows: song 0 played in 17/20 = 0.85 (lock), song 1 played in 16/20 = 0.80 (rotating)
      const setlists = buildSetlists([17, 16], 20);
      const result = aggregateSetlists({
        mbid: "m",
        artistName: "Boundary Test",
        sourceUrl: "https://example.com",
        setlists,
        now: NOW,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("expected ok");
      const byName = new Map(result.songs.map((s) => [s.name, s]));
      expect(byName.get("Song 0")?.playRate).toBe(0.85);
      expect(byName.get("Song 0")?.tier).toBe("lock");
      expect(byName.get("Song 1")?.playRate).toBe(0.8);
      expect(byName.get("Song 1")?.tier).toBe("rotating");
    });

    it("classifies exactly 0.30 as rotating and just under as rare", () => {
      // 20 shows: song 0 played in 6/20 = 0.30 (rotating), song 1 played in 5/20 = 0.25 (rare)
      const setlists = buildSetlists([6, 5], 20);
      const result = aggregateSetlists({
        mbid: "m",
        artistName: "Boundary Test",
        sourceUrl: "https://example.com",
        setlists,
        now: NOW,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("expected ok");
      const byName = new Map(result.songs.map((s) => [s.name, s]));
      expect(byName.get("Song 0")?.playRate).toBe(0.3);
      expect(byName.get("Song 0")?.tier).toBe("rotating");
      expect(byName.get("Song 1")?.playRate).toBe(0.25);
      expect(byName.get("Song 1")?.tier).toBe("rare");
    });
  });
});
