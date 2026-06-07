import type { AggregateResponse } from "@setlist-scout/shared";
import { describe, expect, it } from "vitest";
import { toPanelViewState } from "../src/panel/view-state";

const OK_DATA: AggregateResponse = {
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

describe("toPanelViewState", () => {
  it("maps the loading sentinel to a loading state", () => {
    expect(toPanelViewState("loading")).toEqual({ kind: "loading" });
  });

  it("maps a network/worker failure to an error state", () => {
    const result = toPanelViewState({
      ok: false,
      error: { code: "network_error", message: "oops" },
    });
    expect(result).toEqual({ kind: "error", message: "oops" });
  });

  it("maps a successful ok aggregate straight through", () => {
    const result = toPanelViewState({ ok: true, data: OK_DATA });
    expect(result).toEqual({ kind: "ok", data: OK_DATA });
  });

  it("maps insufficient_data to its own state", () => {
    const data: AggregateResponse = {
      status: "insufficient_data",
      artistName: "Test Artist",
      showCount: 2,
    };
    expect(toPanelViewState({ ok: true, data })).toEqual({
      kind: "insufficient_data",
      artistName: "Test Artist",
      showCount: 2,
    });
  });

  it("maps artist_not_found to its own state", () => {
    const data: AggregateResponse = {
      status: "artist_not_found",
      query: "zzxqwv",
    };
    expect(toPanelViewState({ ok: true, data })).toEqual({
      kind: "artist_not_found",
      query: "zzxqwv",
    });
  });
});
