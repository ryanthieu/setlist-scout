import { describe, expect, it } from "vitest";
import { parseSetlistFmDate } from "../src/date";

describe("parseSetlistFmDate", () => {
  it("parses dd-MM-yyyy, not the US mm-dd-yyyy order", () => {
    // 01-08-2026 is 1 August, not 8 January -- new Date() would get this wrong.
    const parsed = parseSetlistFmDate("01-08-2026");
    expect(parsed.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("throws on an unrecognized format instead of guessing", () => {
    expect(() => parseSetlistFmDate("2026-08-01")).toThrow();
  });
});
