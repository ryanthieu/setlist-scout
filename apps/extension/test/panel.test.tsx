// @vitest-environment jsdom

import type { AggregateResponse } from "@setlist-scout/shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GetAggregateResult } from "../src/lib/messages";
import { DEFAULT_OPTIONS, type ExtensionOptions } from "../src/lib/options";
import { Panel } from "../src/panel/Panel";

let mountedContainer: HTMLDivElement | null = null;
let mountedRoot: Root | null = null;

afterEach(() => {
  if (mountedRoot) {
    const root = mountedRoot;
    act(() => {
      root.unmount();
    });
  }
  mountedContainer?.remove();
  mountedContainer = null;
  mountedRoot = null;
});

async function renderPanel(
  requestAggregate: (artist: string) => Promise<GetAggregateResult>,
  options: ExtensionOptions = DEFAULT_OPTIONS,
  artist = "Test Artist",
): Promise<HTMLDivElement> {
  mountedContainer = document.createElement("div");
  document.body.appendChild(mountedContainer);
  mountedRoot = createRoot(mountedContainer);
  const root = mountedRoot;
  const container = mountedContainer;
  await act(async () => {
    root.render(
      <Panel
        artist={artist}
        requestAggregate={requestAggregate}
        options={options}
      />,
    );
  });
  return container;
}

function expand(container: HTMLDivElement): Promise<void> {
  const pillButton = container.querySelector(
    ".ss-pill",
  ) as HTMLButtonElement | null;
  return act(async () => {
    pillButton?.click();
  });
}

const OK_DATA: AggregateResponse = {
  status: "ok",
  mbid: "m1",
  artistName: "Test Artist",
  windowDays: 90,
  showsConsidered: 12,
  showsDropped: 0,
  lastShowDate: "2026-08-01T00:00:00.000Z",
  medianSongCount: 18,
  hasEncore: true,
  songs: [
    {
      name: "Song Lock",
      playCount: 12,
      playRate: 1,
      tier: "lock",
      isCover: false,
    },
    {
      name: "Song Rotate",
      playCount: 6,
      playRate: 0.5,
      tier: "rotating",
      isCover: false,
    },
    {
      name: "Song Rare",
      playCount: 1,
      playRate: 0.08,
      tier: "rare",
      isCover: false,
    },
  ],
  sourceUrl: "https://www.setlist.fm/setlists/test-artist.html",
};

describe("Panel", () => {
  it("renders collapsed as a pill by default", async () => {
    const container = await renderPanel(async () => ({
      ok: true,
      data: OK_DATA,
    }));
    expect(container.querySelector(".ss-pill")).not.toBeNull();
    expect(container.querySelector(".ss-panel")).toBeNull();
  });

  it("starts expanded when the autoExpand option is on", async () => {
    const container = await renderPanel(
      async () => ({ ok: true, data: OK_DATA }),
      {
        ...DEFAULT_OPTIONS,
        autoExpand: true,
      },
    );
    expect(container.querySelector(".ss-panel")).not.toBeNull();
    expect(container.querySelector(".ss-pill")).toBeNull();
  });

  it("shows a skeleton while loading, then real data once the request resolves -- locks and rotating only, no rare songs", async () => {
    let resolveRequest: (value: GetAggregateResult) => void = () => {};
    const requestAggregate = vi.fn(
      () =>
        new Promise<GetAggregateResult>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const container = await renderPanel(requestAggregate);
    await expand(container);

    expect(container.querySelector(".ss-skeleton")).not.toBeNull();

    await act(async () => {
      resolveRequest({ ok: true, data: OK_DATA });
    });

    expect(container.querySelector(".ss-skeleton")).toBeNull();
    expect(container.querySelector(".ss-artist-name")?.textContent).toBe(
      "Test Artist",
    );
    const songNames = Array.from(
      container.querySelectorAll(".ss-song-name"),
    ).map((el) => el.textContent);
    expect(songNames).toContain("Song Lock");
    expect(songNames).toContain("Song Rotate");
    expect(songNames).not.toContain("Song Rare");
  });

  it("hides song names in spoiler-free mode, but still shows set length and encore", async () => {
    const container = await renderPanel(
      async () => ({ ok: true, data: OK_DATA }),
      {
        ...DEFAULT_OPTIONS,
        spoilerFree: true,
      },
    );
    await expand(container);

    expect(container.querySelectorAll(".ss-song-name")).toHaveLength(0);
    expect(container.querySelector(".ss-footer")?.textContent).toContain(
      "Typical set length",
    );
    expect(container.querySelector(".ss-footer")?.textContent).toContain(
      "Encore",
    );
  });

  it("shows the insufficient_data state with an explanation, not just a failure", async () => {
    const data: AggregateResponse = {
      status: "insufficient_data",
      artistName: "Test Artist",
      showCount: 2,
    };
    const container = await renderPanel(async () => ({ ok: true, data }));
    await expand(container);
    const text = container.querySelector(".ss-message")?.textContent ?? "";
    expect(text).toMatch(/2 shows/i);
    expect(text).toMatch(/check back/i);
  });

  it("shows the artist_not_found state legibly", async () => {
    const data: AggregateResponse = {
      status: "artist_not_found",
      query: "zzxqwv",
    };
    const container = await renderPanel(async () => ({ ok: true, data }));
    await expand(container);
    expect(container.querySelector(".ss-message")?.textContent).toContain(
      "zzxqwv",
    );
  });

  it("shows a network error state legibly", async () => {
    const container = await renderPanel(async () => ({
      ok: false,
      error: {
        code: "network_error",
        message: "Could not reach Setlist Scout's server.",
      },
    }));
    await expand(container);
    expect(container.querySelector(".ss-message")?.textContent).toMatch(
      /could not reach/i,
    );
  });

  it("shows a stale-data notice alongside real data when stale: true", async () => {
    const container = await renderPanel(async () => ({
      ok: true,
      data: { ...OK_DATA, stale: true },
    }));
    await expand(container);
    expect(container.querySelector(".ss-stale-banner")).not.toBeNull();
  });

  it("is dismissible", async () => {
    const container = await renderPanel(async () => ({
      ok: true,
      data: OK_DATA,
    }));
    await expand(container);

    const dismissButton = container.querySelector(
      '[aria-label="Dismiss"]',
    ) as HTMLButtonElement;
    await act(async () => {
      dismissButton.click();
    });

    expect(container.querySelector(".ss-root")).toBeNull();
  });

  it("collapses back to a pill without dismissing", async () => {
    const container = await renderPanel(async () => ({
      ok: true,
      data: OK_DATA,
    }));
    await expand(container);

    const collapseButton = container.querySelector(
      '[aria-label="Collapse"]',
    ) as HTMLButtonElement;
    await act(async () => {
      collapseButton.click();
    });

    expect(container.querySelector(".ss-pill")).not.toBeNull();
    expect(container.querySelector(".ss-panel")).toBeNull();
  });

  it("is keyboard-dismissible: Escape collapses the expanded panel back to a pill", async () => {
    const container = await renderPanel(async () => ({
      ok: true,
      data: OK_DATA,
    }));
    await expand(container);
    expect(container.querySelector(".ss-panel")).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(container.querySelector(".ss-panel")).toBeNull();
    expect(container.querySelector(".ss-pill")).not.toBeNull();
  });

  it("does not react to Escape while already collapsed", async () => {
    const container = await renderPanel(async () => ({
      ok: true,
      data: OK_DATA,
    }));

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(container.querySelector(".ss-pill")).not.toBeNull();
  });
});
