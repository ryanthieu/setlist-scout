import type { ArtistAggregate, SongStat } from "@setlist-scout/shared";
import { parseSetlistFmDate } from "./date";
import type { SetlistFmSetlist, SetlistFmSong } from "./setlistfm";

const MIN_SHOWS = 5;
const MIN_SONGS_PER_SHOW = 5;
const LOCK_THRESHOLD = 0.85;
const ROTATING_THRESHOLD = 0.3;
const DAY_MS = 24 * 60 * 60 * 1000;

type SongAccumulator = {
  casingCounts: Map<string, number>;
  playCount: number;
  isCover: boolean;
};

function flattenSongs(setlist: SetlistFmSetlist): SetlistFmSong[] {
  return setlist.sets.set.flatMap((set) =>
    (set.song ?? []).filter((song) => !song.tape),
  );
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function tierFor(playRate: number): SongStat["tier"] {
  if (playRate >= LOCK_THRESHOLD) return "lock";
  if (playRate >= ROTATING_THRESHOLD) return "rotating";
  return "rare";
}

function mostCommonCasing(counts: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (sorted.length % 2 === 0 && lower !== undefined && upper !== undefined) {
    return (lower + upper) / 2;
  }
  return sorted[mid] ?? 0;
}

export function aggregateSetlists(input: {
  mbid: string;
  artistName: string;
  sourceUrl: string;
  setlists: SetlistFmSetlist[];
  now?: Date;
}): ArtistAggregate {
  const { mbid, artistName, sourceUrl, setlists, now = new Date() } = input;

  const nonEmpty = setlists.filter((sl) => flattenSongs(sl).length > 0);

  const within = (days: number) =>
    nonEmpty.filter(
      (sl) =>
        now.getTime() - parseSetlistFmDate(sl.eventDate).getTime() <=
        days * DAY_MS,
    );

  let windowDays = 90;
  let candidates = within(90);
  if (candidates.length < MIN_SHOWS) {
    windowDays = 180;
    candidates = within(180);
  }
  if (candidates.length < MIN_SHOWS) {
    return {
      status: "insufficient_data",
      artistName,
      showCount: candidates.length,
    };
  }

  const qualifying = candidates.filter(
    (sl) => flattenSongs(sl).length >= MIN_SONGS_PER_SHOW,
  );
  if (qualifying.length === 0) {
    return {
      status: "insufficient_data",
      artistName,
      showCount: candidates.length,
    };
  }

  const showsConsidered = qualifying.length;
  const showsDropped = candidates.length - qualifying.length;

  const accumulators = new Map<string, SongAccumulator>();

  for (const setlist of qualifying) {
    const songsInThisShow = new Set<string>();
    for (const song of flattenSongs(setlist)) {
      const key = normalizeName(song.name);
      const displayName = song.name.trim().replace(/\s+/g, " ");

      let acc = accumulators.get(key);
      if (!acc) {
        acc = { casingCounts: new Map(), playCount: 0, isCover: false };
        accumulators.set(key, acc);
      }
      acc.casingCounts.set(
        displayName,
        (acc.casingCounts.get(displayName) ?? 0) + 1,
      );
      if (song.cover) acc.isCover = true;
      songsInThisShow.add(key);
    }
    for (const key of songsInThisShow) {
      const acc = accumulators.get(key);
      if (acc) acc.playCount += 1;
    }
  }

  const songs: SongStat[] = [...accumulators.values()]
    .map((acc) => {
      const playRate = acc.playCount / showsConsidered;
      return {
        name: mostCommonCasing(acc.casingCounts),
        playCount: acc.playCount,
        playRate,
        tier: tierFor(playRate),
        isCover: acc.isCover,
      };
    })
    .sort((a, b) => b.playRate - a.playRate);

  const medianSongCount = median(
    qualifying.map((sl) => flattenSongs(sl).length),
  );

  const encoreShows = qualifying.filter((sl) =>
    sl.sets.set.some((set) => (set.encore ?? 0) > 0),
  ).length;
  const hasEncore = encoreShows / showsConsidered > 0.5;

  const lastShowDate = candidates
    .map((sl) => parseSetlistFmDate(sl.eventDate))
    .reduce((latest, d) => (d > latest ? d : latest))
    .toISOString();

  return {
    status: "ok",
    mbid,
    artistName,
    windowDays,
    showsConsidered,
    showsDropped,
    lastShowDate,
    medianSongCount,
    hasEncore,
    songs,
    sourceUrl,
  };
}
