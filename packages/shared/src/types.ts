export type SongStat = {
  name: string;
  playCount: number;
  playRate: number; // 0..1
  tier: "lock" | "rotating" | "rare";
  isCover: boolean;
};

/** A song played in the current touring window whose only prior appearance (within the lookback window) was more than 2 years earlier. */
export type Bustout = {
  name: string;
  comebackDate: string; // ISO -- first time it reappeared in the current window
  previousDate: string; // ISO -- its most recent appearance before that, found within the lookback window
  gapDays: number;
};

export type ArtistAggregate =
  | {
      status: "ok";
      mbid: string;
      artistName: string;
      windowDays: number;
      showsConsidered: number;
      showsDropped: number;
      lastShowDate: string; // ISO
      medianSongCount: number;
      hasEncore: boolean;
      songs: SongStat[]; // sorted by playRate desc
      sourceUrl: string; // setlist.fm artist page, for attribution
      // Absent until computed (it's expensive -- see worker's bustouts.ts),
      // present-but-empty once computed with nothing found.
      bustouts?: Bustout[];
    }
  | { status: "insufficient_data"; artistName: string; showCount: number }
  | { status: "artist_not_found"; query: string };

/** What GET /aggregate actually returns on the wire: an ArtistAggregate plus caching metadata. */
export type AggregateResponse = ArtistAggregate & {
  cached?: boolean;
  stale?: boolean;
};

export type EventContext = {
  artist: string;
  date: string | null; // ISO
  venue: string | null;
  city: string | null;
  source: "jsonld" | "dom";
};
