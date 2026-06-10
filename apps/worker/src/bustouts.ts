import type { Bustout } from "@setlist-scout/shared";
import { normalizeArtistQuery } from "@setlist-scout/shared";
import { flattenSongs } from "./aggregate";
import { parseSetlistFmDate } from "./date";
import type { SetlistFmSetlist } from "./setlistfm";

const BUSTOUT_GAP_DAYS = 2 * 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A song counts as a bustout if its earliest appearance in the current
 * touring window came more than 2 years after its most recent appearance
 * before that window. Songs with no appearance at all in `olderSetlists`
 * are skipped, not flagged -- that could mean "brand new song" just as
 * easily as "gap wider than we looked back," and we'd rather say nothing
 * than guess.
 */
export function detectBustouts(input: {
  windowSetlists: SetlistFmSetlist[];
  olderSetlists: SetlistFmSetlist[];
}): Bustout[] {
  const { windowSetlists, olderSetlists } = input;

  const comebackDates = new Map<string, { displayName: string; date: Date }>();
  const sortedWindowAsc = [...windowSetlists].sort(
    (a, b) =>
      parseSetlistFmDate(a.eventDate).getTime() -
      parseSetlistFmDate(b.eventDate).getTime(),
  );
  for (const setlist of sortedWindowAsc) {
    const date = parseSetlistFmDate(setlist.eventDate);
    for (const song of flattenSongs(setlist)) {
      const key = normalizeArtistQuery(song.name);
      if (!comebackDates.has(key)) {
        comebackDates.set(key, {
          displayName: song.name.trim().replace(/\s+/g, " "),
          date,
        });
      }
    }
  }

  const previousDates = new Map<string, Date>();
  const sortedOlderDesc = [...olderSetlists].sort(
    (a, b) =>
      parseSetlistFmDate(b.eventDate).getTime() -
      parseSetlistFmDate(a.eventDate).getTime(),
  );
  for (const setlist of sortedOlderDesc) {
    const date = parseSetlistFmDate(setlist.eventDate);
    for (const song of flattenSongs(setlist)) {
      const key = normalizeArtistQuery(song.name);
      if (!previousDates.has(key)) {
        previousDates.set(key, date);
      }
    }
  }

  const bustouts: Bustout[] = [];
  for (const [key, comeback] of comebackDates) {
    const previous = previousDates.get(key);
    if (!previous) continue;

    const gapDays = Math.round(
      (comeback.date.getTime() - previous.getTime()) / DAY_MS,
    );
    if (gapDays > BUSTOUT_GAP_DAYS) {
      bustouts.push({
        name: comeback.displayName,
        comebackDate: comeback.date.toISOString(),
        previousDate: previous.toISOString(),
        gapDays,
      });
    }
  }

  return bustouts.sort((a, b) => b.gapDays - a.gapDays);
}
