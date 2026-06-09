import type { EventContext } from "@setlist-scout/shared";

type JsonLdNode = Record<string, unknown>;

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function isObject(value: unknown): value is JsonLdNode {
  return typeof value === "object" && value !== null;
}

function hasType(node: JsonLdNode, typeName: string): boolean {
  const type = node["@type"];
  if (typeof type === "string") return type === typeName;
  if (Array.isArray(type)) return type.includes(typeName);
  return false;
}

/** Walks @graph wrappers (used by some JSON-LD producers) to a flat node list. */
function flattenJsonLdNodes(parsed: unknown): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (isObject(value)) {
      nodes.push(value);
      if ("@graph" in value) visit(value["@graph"]);
    }
  };
  visit(parsed);
  return nodes;
}

/**
 * Real Ticketmaster event pages use a non-standard "performers" (plural)
 * key, not schema.org's documented "performer". Accepting both, and either
 * a single object or an array, since there's no guarantee that's consistent
 * across page templates.
 */
function extractPerformerName(node: JsonLdNode): string | null {
  const list = toArray(
    node.performers as JsonLdNode | JsonLdNode[] | undefined,
  ).concat(toArray(node.performer as JsonLdNode | JsonLdNode[] | undefined));
  const first = list.find(
    (entry) => isObject(entry) && typeof entry.name === "string",
  );
  return first && isObject(first) && typeof first.name === "string"
    ? first.name
    : null;
}

function extractIsoDate(node: JsonLdNode): string | null {
  if (typeof node.startDate !== "string") return null;
  const parsed = new Date(node.startDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extractLocation(node: JsonLdNode): {
  venue: string | null;
  city: string | null;
} {
  // schema.org's `location` is normally a single Place, but real producers
  // (Dice, for a multi-room venue) sometimes emit an array -- take the first.
  const rawLocation = node.location;
  const location = Array.isArray(rawLocation) ? rawLocation[0] : rawLocation;
  if (!isObject(location)) return { venue: null, city: null };

  const venue = typeof location.name === "string" ? location.name : null;
  const address = location.address;
  const city =
    isObject(address) && typeof address.addressLocality === "string"
      ? address.addressLocality
      : null;

  return { venue, city };
}

/**
 * Parses raw <script type="application/ld+json"> text content, looking for
 * a MusicEvent node (possibly nested under @graph, possibly one of several
 * script tags on the page -- Ticketmaster also emits a BreadcrumbList one).
 * Returns null if no MusicEvent with a resolvable performer name is found,
 * rather than guessing.
 */
export function extractMusicEventFromJsonLd(
  rawScripts: string[],
): EventContext | null {
  for (const raw of rawScripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const musicEvent = flattenJsonLdNodes(parsed).find((node) =>
      hasType(node, "MusicEvent"),
    );
    if (!musicEvent) continue;

    const artist = extractPerformerName(musicEvent);
    if (!artist) continue;

    const { venue, city } = extractLocation(musicEvent);
    return {
      artist,
      date: extractIsoDate(musicEvent),
      venue,
      city,
      source: "jsonld",
    };
  }

  return null;
}
