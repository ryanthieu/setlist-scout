import { useEffect, useState } from "react";
import type { GetAggregateResult } from "../lib/messages";
import {
  type OkAggregate,
  type PanelViewState,
  toPanelViewState,
} from "./view-state";

export type PanelProps = {
  artist: string;
  requestAggregate: (artist: string) => Promise<GetAggregateResult>;
};

export function Panel({ artist, requestAggregate }: PanelProps) {
  const [result, setResult] = useState<GetAggregateResult | "loading">(
    "loading",
  );
  const [expanded, setExpanded] = useState(false);
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
        <PanelBody view={view} />
      </section>
    </div>
  );
}

function PanelBody({ view }: { view: PanelViewState }) {
  switch (view.kind) {
    case "loading":
      return <p className="ss-message">Loading setlist info…</p>;
    case "error":
      return <p className="ss-message">{view.message}</p>;
    case "artist_not_found":
      return (
        <p className="ss-message">
          Couldn't find "{view.query}" on setlist.fm.
        </p>
      );
    case "insufficient_data":
      return (
        <p className="ss-message">
          Not enough recent shows for {view.artistName} yet ({view.showCount} in
          the last several months) to say what's typical.
        </p>
      );
    case "ok":
      return <OkBody data={view.data} />;
    default:
      return null;
  }
}

function OkBody({ data }: { data: OkAggregate }) {
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
