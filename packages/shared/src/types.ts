export type SongStat = {
  name: string;
  playCount: number;
  playRate: number; // 0..1
  tier: "lock" | "rotating" | "rare";
  isCover: boolean;
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
    }
  | { status: "insufficient_data"; artistName: string; showCount: number }
  | { status: "artist_not_found"; query: string };

export type EventContext = {
  artist: string;
  date: string | null; // ISO
  venue: string | null;
  city: string | null;
  source: "jsonld" | "dom";
};
