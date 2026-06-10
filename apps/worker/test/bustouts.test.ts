import { describe, expect, it } from "vitest";
import { detectBustouts } from "../src/bustouts";
import type { SetlistFmSetlist } from "../src/setlistfm";
import phishP1 from "./fixtures/setlistfm-phish-p1.json";
import phishP7Older from "./fixtures/setlistfm-phish-p7-older.json";
import phishP8Older from "./fixtures/setlistfm-phish-p8-older.json";

// phishP1 is the same real "current tour" fixture used in aggregate.test.ts
// (shows from Jul-Aug 2026). p7/p8 are real setlist.fm pages fetched
// separately, covering mid-late 2023 -- genuinely two to three years before
// the current window, which is exactly the shape a live /aggregate request
// would produce (recent fetch + a separate wider historical fetch).
const windowSetlists = phishP1.setlist as SetlistFmSetlist[];
const olderSetlists = [
  ...phishP7Older.setlist,
  ...phishP8Older.setlist,
] as SetlistFmSetlist[];

describe("detectBustouts", () => {
  it("finds real, verified bustouts from actual Phish touring history", () => {
    const bustouts = detectBustouts({ windowSetlists, olderSetlists });
    const byName = new Map(bustouts.map((b) => [b.name, b]));

    // Verified by hand against setlist.fm: each of these was genuinely
    // absent for multiple years before reappearing in the 2026 fixture.
    expect(byName.get("Talk")).toEqual({
      name: "Talk",
      comebackDate: "2026-07-29T00:00:00.000Z",
      previousDate: "2023-10-13T00:00:00.000Z",
      gapDays: 1020,
    });
    expect(byName.get("Drowned")?.gapDays).toBe(1016);
    expect(byName.get("Harpua")?.gapDays).toBe(941);
    expect(byName.get("Makisupa Policeman")?.gapDays).toBe(1109);
    expect(byName.get("Fire")?.gapDays).toBe(1085);
  });

  it("sorts bustouts by gap length, longest first", () => {
    const bustouts = detectBustouts({ windowSetlists, olderSetlists });
    for (let i = 1; i < bustouts.length; i++) {
      expect(bustouts[i - 1]?.gapDays).toBeGreaterThanOrEqual(
        bustouts[i]?.gapDays ?? 0,
      );
    }
  });

  it("does not flag a song that appears in both the window and recent older history (not a real gap)", () => {
    // "Sand" appears in the Phish window fixture and, being a regular
    // rotation song, would also appear somewhere in real recent history --
    // build a synthetic older setlist to make that explicit rather than
    // relying on it happening to be absent from p7/p8.
    const recentOlder: SetlistFmSetlist = {
      id: "recent-older",
      eventDate: "01-01-2026",
      artist: { mbid: "m", name: "Phish", url: "https://example.com" },
      sets: { set: [{ song: [{ name: "Sand" }] }] },
    };
    const bustouts = detectBustouts({
      windowSetlists,
      olderSetlists: [...olderSetlists, recentOlder],
    });
    expect(bustouts.some((b) => b.name === "Sand")).toBe(false);
  });

  it("does not flag a song with no appearance at all in the lookback data", () => {
    const windowOnly: SetlistFmSetlist = {
      id: "w1",
      eventDate: "01-08-2026",
      artist: { mbid: "m", name: "Test", url: "https://example.com" },
      sets: { set: [{ song: [{ name: "Brand New Song" }] }] },
    };
    const bustouts = detectBustouts({
      windowSetlists: [windowOnly],
      olderSetlists: [],
    });
    expect(bustouts).toEqual([]);
  });

  describe("the 2-year boundary", () => {
    function setlist(id: string, date: string, song: string): SetlistFmSetlist {
      return {
        id,
        eventDate: date,
        artist: { mbid: "m", name: "Test", url: "https://example.com" },
        sets: { set: [{ song: [{ name: song }] }] },
      };
    }

    it("does not flag a gap of exactly 730 days", () => {
      // 730 days before 30-08-2026 is 30-08-2024.
      const bustouts = detectBustouts({
        windowSetlists: [setlist("w", "30-08-2026", "Boundary Song")],
        olderSetlists: [setlist("o", "30-08-2024", "Boundary Song")],
      });
      expect(bustouts).toEqual([]);
    });

    it("flags a gap of 731 days", () => {
      const bustouts = detectBustouts({
        windowSetlists: [setlist("w", "30-08-2026", "Boundary Song")],
        olderSetlists: [setlist("o", "29-08-2024", "Boundary Song")],
      });
      expect(bustouts).toHaveLength(1);
      expect(bustouts[0]?.gapDays).toBe(731);
    });
  });

  it("uses the earliest in-window occurrence as the comeback date, not the latest", () => {
    const early = {
      id: "e",
      eventDate: "01-07-2026",
      artist: { mbid: "m", name: "Test", url: "https://example.com" },
      sets: { set: [{ song: [{ name: "Returning Song" }] }] },
    };
    const later = {
      id: "l",
      eventDate: "01-08-2026",
      artist: { mbid: "m", name: "Test", url: "https://example.com" },
      sets: { set: [{ song: [{ name: "Returning Song" }] }] },
    };
    const older = {
      id: "o",
      eventDate: "01-01-2020",
      artist: { mbid: "m", name: "Test", url: "https://example.com" },
      sets: { set: [{ song: [{ name: "Returning Song" }] }] },
    };

    const bustouts = detectBustouts({
      windowSetlists: [later, early],
      olderSetlists: [older],
    });
    expect(bustouts[0]?.comebackDate).toBe("2026-07-01T00:00:00.000Z");
  });
});
