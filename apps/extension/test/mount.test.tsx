// @vitest-environment jsdom

import type { AggregateResponse, EventContext } from "@setlist-scout/shared";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountPanel } from "../src/panel/mount";

const SAMPLE: AggregateResponse = {
  status: "ok",
  mbid: "m1",
  artistName: "Test Artist",
  windowDays: 90,
  showsConsidered: 12,
  showsDropped: 0,
  lastShowDate: "2026-08-01T00:00:00.000Z",
  medianSongCount: 18,
  hasEncore: true,
  songs: [],
  sourceUrl: "https://example.com",
};

const CONTEXT: EventContext = {
  artist: "Test Artist",
  date: null,
  venue: null,
  city: null,
  source: "jsonld",
};

beforeEach(() => {
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({ ok: true, data: SAMPLE }),
    },
    storage: {
      local: { get: vi.fn().mockResolvedValue({}) },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("mountPanel", () => {
  it("mounts a single host element with an open shadow root containing styles and the panel", async () => {
    await act(async () => {
      mountPanel(CONTEXT);
    });

    const host = document.getElementById("setlist-scout-host");
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).not.toBeNull();
    expect(host?.shadowRoot?.mode).toBe("open");
    expect(host?.shadowRoot?.querySelector("style")).not.toBeNull();
    expect(host?.shadowRoot?.querySelector(".ss-root")).not.toBeNull();
  });

  it("keeps panel markup inside the shadow root -- nothing leaks into the light DOM", async () => {
    await act(async () => {
      mountPanel(CONTEXT);
    });

    expect(document.body.querySelector(".ss-root")).toBeNull();
    expect(document.body.children).toHaveLength(1);
    expect(document.body.children[0]?.id).toBe("setlist-scout-host");
  });

  it("does not create a second host if called again on the same page", async () => {
    await act(async () => {
      mountPanel(CONTEXT);
    });
    await act(async () => {
      mountPanel(CONTEXT);
    });

    expect(document.querySelectorAll("#setlist-scout-host")).toHaveLength(1);
  });
});
