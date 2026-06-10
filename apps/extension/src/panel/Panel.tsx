import { useEffect, useState } from "react";
import type { GetAggregateResult } from "../lib/messages";
import type { ExtensionOptions } from "../lib/options";
import {
  type OkAggregate,
  type PanelViewState,
  toPanelViewState,
} from "./view-state";

export type PanelProps = {
  artist: string;
  requestAggregate: (artist: string) => Promise<GetAggregateResult>;
  options: ExtensionOptions;
};

export function Panel({ artist, requestAggregate, options }: PanelProps) {
  const [result, setResult] = useState<GetAggregateResult | "loading">(
    "loading",
  );
  // autoExpand only seeds the initial state -- toggling it later in the
  // options page shouldn't yank open/closed a panel someone already
  // expanded or collapsed by hand.
  const [expanded, setExpanded] = useState(options.autoExpand);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResult("loading");
    requestAggregate(artist).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [artist, requestAggregate]);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  if (dismissed) return null;

  const view = toPanelViewState(result);

  if (!expanded) {
    return (
      <div className="ss-root">
        <button
          type="button"
          className="ss-pill"
          onClick={() => setExpanded(true)}
        >
          🎵 Setlist Scout
        </button>
      </div>
    );
  }

  return (
    <div className="ss-root">
      <section className="ss-panel" aria-label="Setlist Scout">
        <div className="ss-panel-controls">
          <button
            type="button"
            className="ss-icon-button"
            onClick={() => setExpanded(false)}
            aria-label="Collapse"
          >
            –
          </button>
          <button
            type="button"
            className="ss-icon-button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
        <PanelBody view={view} spoilerFree={options.spoilerFree} />
      </section>
    </div>
  );
}

function PanelBody({
  view,
  spoilerFree,
}: {
  view: PanelViewState;
  spoilerFree: boolean;
}) {
  switch (view.kind) {
    case "loading":
      return <SkeletonBody />;
    case "error":
      return <p className="ss-message">{view.message}</p>;
    case "artist_not_found":
      return (
        <p className="ss-message">
          Couldn't find "{view.query}" on setlist.fm. The name might be spelled
          differently there, or this artist might not have a setlist.fm page
          yet.
        </p>
      );
    case "insufficient_data":
      return (
        <p className="ss-message">
          {view.artistName} has only played {view.showCount} show
          {view.showCount === 1 ? "" : "s"} recently on setlist.fm -- not enough
          yet to say what's typical for this tour. Check back closer to the
          show.
        </p>
      );
    case "ok":
      return <OkBody data={view.data} spoilerFree={spoilerFree} />;
    default:
      return null;
  }
}

function SkeletonBody() {
  return (
    <div
      className="ss-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading setlist info"
    >
      <div className="ss-skeleton-line ss-skeleton-title" />
      <div className="ss-skeleton-line ss-skeleton-subline" />
      <div className="ss-skeleton-line" />
      <div className="ss-skeleton-line" />
      <div className="ss-skeleton-line ss-skeleton-short" />
    </div>
  );
}

function OkBody({
  data,
  spoilerFree,
}: {
  data: OkAggregate;
  spoilerFree: boolean;
}) {
  const locks = data.songs.filter((s) => s.tier === "lock");
  const rotating = data.songs.filter((s) => s.tier === "rotating");

  return (
    <>
      {data.stale && (
        <div className="ss-stale-banner">
          Showing the last data we had — couldn't refresh from setlist.fm just
          now.
        </div>
      )}
      <div className="ss-header">
        <p className="ss-artist-name">{data.artistName}</p>
        <p className="ss-subline">
          Based on {data.showsConsidered} shows in the last {data.windowDays}{" "}
          days
        </p>
      </div>
      {spoilerFree ? (
        <p className="ss-empty">
          Spoiler-free mode is on — song names are hidden.
        </p>
      ) : (
        <>
          {data.bustouts && data.bustouts.length > 0 && (
            <BustoutSection bustouts={data.bustouts} />
          )}
          <SongSection
            title="Locks"
            songs={locks}
            emptyText="No songs played almost every night this tour."
          />
          <SongSection
            title="Rotating"
            songs={rotating}
            emptyText="Nothing in regular rotation."
          />
        </>
      )}
      <div className="ss-footer">
        <p className="ss-footer-line">
          Typical set length: {data.medianSongCount} songs
        </p>
        <p className="ss-footer-line">
          Encore: {data.hasEncore ? "Usually" : "Not usually"}
        </p>
        <a
          className="ss-attribution"
          href={data.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Data from setlist.fm
        </a>
      </div>
    </>
  );
}

function formatGapYears(gapDays: number): string {
  const years = gapDays / 365;
  return years >= 2
    ? `${Math.round(years)} years`
    : `${years.toFixed(1)} years`;
}

/** Bustouts get their own distinct, called-out treatment -- this is the
 * emotionally interesting data (a song that hadn't been played in years
 * suddenly turning up), and blending it into the plain Rotating list would
 * bury the moment that actually deserves it. */
function BustoutSection({
  bustouts,
}: {
  bustouts: NonNullable<OkAggregate["bustouts"]>;
}) {
  return (
    <div className="ss-section ss-bustouts">
      <p className="ss-section-title ss-bustouts-title">🔥 Bustouts</p>
      <ul className="ss-song-list">
        {bustouts.map((b) => (
          <li key={b.name} className="ss-bustout-row">
            <span className="ss-song-name">{b.name}</span>
            <span className="ss-bustout-gap">
              back after {formatGapYears(b.gapDays)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SongSection({
  title,
  songs,
  emptyText,
}: {
  title: string;
  songs: OkAggregate["songs"];
  emptyText: string;
}) {
  return (
    <div className="ss-section">
      <p className="ss-section-title">{title}</p>
      {songs.length > 0 ? (
        <ul className="ss-song-list">
          {songs.map((song) => (
            <li key={song.name} className="ss-song-row">
              <span className="ss-song-name">{song.name}</span>
              <span className="ss-song-rate">
                {Math.round(song.playRate * 100)}%
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ss-empty">{emptyText}</p>
      )}
    </div>
  );
}
