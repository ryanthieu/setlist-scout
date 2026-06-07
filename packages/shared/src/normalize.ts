export function normalizeArtistQuery(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
