const SETLISTFM_DATE = /^(?<day>\d{2})-(?<month>\d{2})-(?<year>\d{4})$/;

/** setlist.fm's eventDate is dd-MM-yyyy, which `new Date()` cannot parse reliably. */
export function parseSetlistFmDate(dateStr: string): Date {
  const groups = SETLISTFM_DATE.exec(dateStr)?.groups;
  if (!groups) {
    throw new Error(`Unexpected setlist.fm date format: ${dateStr}`);
  }
  const { day, month, year } = groups;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}
